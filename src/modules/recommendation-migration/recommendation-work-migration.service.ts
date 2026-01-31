import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderService } from 'src/modules/order/order.service';
import { EmployeeService } from 'src/modules/employee/employee.service';
import { PubSub } from 'graphql-subscriptions';
import { RealizeCarRecommendationInput } from 'src/modules/recommendation-migration/inputs/realize-car-recommendation.input';
import { RealizeCarRecommendationPayload } from 'src/modules/recommendation-migration/models/realize-car-recommendation.payload';
import { ReturnWorkToRecommendationInput } from 'src/modules/recommendation-migration/inputs/return-work-to-recommendation.input';
import { ReturnWorkToRecommendationPayload } from 'src/modules/recommendation-migration/models/return-work-to-recommendation.payload';
import { OrderItemService } from 'src/modules/order/order-item.service';
import { RecommendationService } from 'src/modules/recommendation/recommendation.service';
import {
  normalizeMoneyAmount,
  rubCurrencyCode,
} from 'src/common/utils/money.util';
import { v6 as uuidv6 } from 'uuid';

@Injectable()
export class RecommendationWorkMigrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
    private readonly orderItemService: OrderItemService,
    private readonly employeeService: EmployeeService,
    private readonly recommendationService: RecommendationService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  private async publishOrderUpdated(orderId: string): Promise<void> {
    const order = await this.orderService.findOne(orderId);
    if (!order) return;

    await this.pubSub.publish(`ORDER_UPDATED_${orderId}`, {
      orderUpdated: {
        ...order,
        orderId,
      },
    });
  }

  private async publishCarRecommendationsUpdated(carId: string): Promise<void> {
    const recommendations = await this.recommendationService.findByCarId(carId);
    await this.pubSub.publish(`CAR_RECOMMENDATIONS_UPDATED_${carId}`, {
      carRecommendationsUpdated: recommendations,
      carId,
    });
  }

  /**
   * Получает текущие параметры сессии PostgreSQL для передачи в транзакцию
   */
  private async getSessionParams(): Promise<{ userId: string | null; tenantId: string | null }> {
    try {
      const result = await this.prisma.$queryRawUnsafe<
        Array<{ user_id: string; tenant_id: string }>
      >(`SELECT 
          current_setting('app.user_id', true) as user_id,
          current_setting('app.tenant_id', true) as tenant_id`);
      return {
        userId: result[0]?.user_id?.trim() || null,
        tenantId: result[0]?.tenant_id?.trim() || null,
      };
    } catch {
      return { userId: null, tenantId: null };
    }
  }

  /**
   * Устанавливает параметры сессии внутри транзакции
   */
  private async setSessionParamsInTx(
    tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
    params: { userId: string | null; tenantId: string | null },
  ): Promise<void> {
    if (params.userId) {
      await tx.$executeRawUnsafe(`SET app.user_id = '${params.userId}'`);
    }
    if (params.tenantId) {
      await tx.$executeRawUnsafe(`SET app.tenant_id = '${params.tenantId}'`);
    }
  }

  private toNetAmount(
    priceAmount?: bigint | null,
    discountAmount?: bigint | null,
  ): bigint {
    const net = normalizeMoneyAmount(priceAmount) - normalizeMoneyAmount(discountAmount);
    return net < 0n ? 0n : net;
  }

  private buildPartsMap(
    parts: Array<{ partId: string; quantity: number }>,
  ): Map<string, number> {
    const map = new Map<string, number>();
    for (const part of parts) {
      if (part.quantity <= 0) continue;
      map.set(part.partId, (map.get(part.partId) ?? 0) + part.quantity);
    }
    return map;
  }

  private isSameParts(
    left: Map<string, number>,
    right: Map<string, number>,
  ): boolean {
    if (left.size !== right.size) return false;
    for (const [partId, quantity] of left.entries()) {
      if (right.get(partId) !== quantity) return false;
    }
    return true;
  }

  private async resolveRecommendationWorkerPersonId(
    orderWorkerId: string | null,
    serviceWorkerPersonId: string | null,
  ): Promise<string | null> {
    if (orderWorkerId) {
      const personId = await this.employeeService.resolvePersonIdByEmployeeId(orderWorkerId);
      return personId ?? serviceWorkerPersonId ?? null;
    }
    return serviceWorkerPersonId ?? null;
  }

  async realizeCarRecommendation(
    input: RealizeCarRecommendationInput,
  ): Promise<RealizeCarRecommendationPayload[]> {
    await this.orderService.validateOrderEditable(input.orderId);
    const order = await this.orderService.findOne(input.orderId);
    if (!order) {
      throw new NotFoundException(`Заказ с ID ${input.orderId} не найден`);
    }

    // В OrderItemService.workerId хранится personId, а в Order.workerId — employeeId
    // Конвертируем employeeId → personId
    const workerPersonId = await this.employeeService.resolvePersonIdByEmployeeId(
      order.workerId ?? null,
    );

    // Получаем параметры сессии для передачи в транзакции
    const sessionParams = await this.getSessionParams();

    const results: RealizeCarRecommendationPayload[] = [];

    for (const selection of input.recommendations) {
      try {
        const recommendationId = selection.recommendationId;
        const recommendation = await this.prisma.carRecommendation.findUnique({
          where: { id: recommendationId },
          include: { parts: true },
        });

        if (!recommendation) {
          throw new NotFoundException(
            `Рекомендация с ID ${recommendationId} не найдена`,
          );
        }

        if (recommendation.expiredAt || recommendation.realization) {
          throw new BadRequestException('Рекомендация уже реализована');
        }

        const serviceItemId = uuidv6();
        const selectedPartIds = new Set(selection.partIds ?? []);
        const recommendationPartsById = new Map(
          recommendation.parts.map((part) => [part.id, part]),
        );

        if (selectedPartIds.size > 0) {
          const unknownPartId = Array.from(selectedPartIds).find(
            (id) => !recommendationPartsById.has(id),
          );
          if (unknownPartId) {
            throw new BadRequestException(
              'Переданы запчасти, не принадлежащие рекомендации',
            );
          }
        }

        const selectedParts =
          selectedPartIds.size === 0
            ? []
            : recommendation.parts.filter((part) => selectedPartIds.has(part.id));
        const createdParts = await this.prisma.$transaction(async (tx) => {
          // Устанавливаем параметры сессии внутри транзакции
          await this.setSessionParamsInTx(tx, sessionParams);

          await tx.orderItem.create({
            data: {
              id: serviceItemId,
              orderId: input.orderId,
              parentId: null,
              type: '1',
              tenantId: order.tenantId,
              service: {
                create: {
                  service: recommendation.service,
                  workerId: workerPersonId,
                  warranty: false,
                  priceAmount: normalizeMoneyAmount(recommendation.priceAmount),
                  priceCurrencyCode: rubCurrencyCode(),
                  discountAmount: normalizeMoneyAmount(undefined),
                  discountCurrencyCode: rubCurrencyCode(),
                },
              },
            },
          });

          const parts = await this.orderItemService.createPartsForService(
            {
              orderId: input.orderId,
              parentId: serviceItemId,
              tenantId: order.tenantId,
              parts: selectedParts.map((part) => ({
                partId: part.partId,
                quantity: part.quantity,
                priceAmount: part.priceAmount ?? null,
              })),
              validateOrderEditable: false,
            },
            tx,
          );

          const updated = await tx.carRecommendation.updateMany({
            where: { id: recommendationId, expiredAt: null, realization: null },
            data: { realization: serviceItemId, expiredAt: new Date() },
          });

          if (updated.count === 0) {
            throw new BadRequestException('Рекомендация уже реализована');
          }

          return parts;
        });

        // TODO: унифицировать резервирование в одном методе создания/удаления запчастей
        await this.orderItemService.reservePartsBestEffort(
          createdParts,
          order.tenantId,
        );

        results.push({
          orderId: input.orderId,
          orderItemServiceId: serviceItemId,
          recommendationId,
        });

        const carIdToPublish = recommendation.carId ?? order.carId;
        if (carIdToPublish) {
          await this.publishCarRecommendationsUpdated(carIdToPublish);
        }
      } catch {
        // best-effort: продолжаем обработку остальных рекомендаций
        // TODO: собирать ошибки и возвращать в payload, чтобы клиент знал, какие рекомендации не обработались
      }
    }

    if (results.length > 0) {
      await this.publishOrderUpdated(input.orderId);
      // Публикуем обновление рекомендаций для carId из заказа
      if (order.carId) {
        await this.publishCarRecommendationsUpdated(order.carId);
      }
    }

    return results;
  }

  async returnWorkToRecommendation(
    input: ReturnWorkToRecommendationInput,
  ): Promise<ReturnWorkToRecommendationPayload> {
    // Валидация и получение данных — вне транзакции
    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: input.orderItemServiceId },
      include: {
        service: true,
        children: {
          include: { part: true },
        },
      },
    });

    if (!orderItem || !orderItem.service) {
      throw new NotFoundException(
        `Работа с ID ${input.orderItemServiceId} не найдена`,
      );
    }

    if (!orderItem.orderId) {
      throw new BadRequestException('Не указан заказ для работы');
    }

    await this.orderService.validateOrderEditable(orderItem.orderId);
    const order = await this.orderService.findOne(orderItem.orderId);
    if (!order) {
      throw new NotFoundException(`Заказ с ID ${orderItem.orderId} не найден`);
    }

    const recommendation = await this.recommendationService.findByRealization(
      input.orderItemServiceId,
    );

    const workParts = orderItem.children
      .filter((child) => child.part)
      .map((child) => ({
        partId: child.part!.partId,
        quantity: child.part!.quantity,
        priceAmount: child.part!.priceAmount ?? null,
        discountAmount: child.part!.discountAmount ?? null,
      }))
      .filter((part) => part.quantity > 0);

    const workPartsMap = this.buildPartsMap(
      workParts.map((part) => ({ partId: part.partId, quantity: part.quantity })),
    );
    const recommendationPartsMap = recommendation
      ? this.buildPartsMap(
          recommendation.parts.map((part) => ({
            partId: part.partId,
            quantity: part.quantity,
          })),
        )
      : new Map<string, number>();
    const sameComposition = recommendation
      ? this.isSameParts(workPartsMap, recommendationPartsMap)
      : false;
    const isSameServiceName = recommendation
      ? orderItem.service.service === recommendation.service
      : false;

    const serviceNetPrice = this.toNetAmount(
      orderItem.service.priceAmount ?? null,
      orderItem.service.discountAmount ?? null,
    );

    // Предвычисляем workerId вне транзакции
    const carId = order.carId ?? recommendation?.carId;
    const workerId = await this.resolveRecommendationWorkerPersonId(
      order.workerId ?? null,
      orderItem.service.workerId ?? null,
    );

    // Получаем параметры сессии для передачи в транзакцию
    const sessionParams = await this.getSessionParams();

    // Все изменения данных — в транзакции
    const resolvedRecommendationId = await this.prisma.$transaction(async (tx) => {
      // Устанавливаем параметры сессии внутри транзакции
      await this.setSessionParamsInTx(tx, sessionParams);

      let resultRecommendationId: string;

      if (recommendation && sameComposition) {
        resultRecommendationId = recommendation.id;
        const workPartsByPartId = new Map(
          workParts.map((part) => [part.partId, part]),
        );

        await this.recommendationService.updateRecommendation(
          {
            id: recommendation.id,
            service: orderItem.service!.service,
            priceAmount: serviceNetPrice,
            priceCurrencyCode: rubCurrencyCode(),
            expiredAt: null,
            realization: null,
          },
          tx,
        );

        for (const recPart of recommendation.parts) {
          const workPart = workPartsByPartId.get(recPart.partId);
          if (!workPart) continue;
          await this.recommendationService.updateRecommendationPart(
            {
              id: recPart.id,
              priceAmount: this.toNetAmount(
                workPart.priceAmount ?? null,
                workPart.discountAmount ?? null,
              ),
              priceCurrencyCode: rubCurrencyCode(),
            },
            tx,
          );
        }
      } else if (recommendation && workParts.length === 0 && isSameServiceName) {
        resultRecommendationId = recommendation.id;
        await this.recommendationService.updateRecommendation(
          {
            id: recommendation.id,
            service: orderItem.service!.service,
            priceAmount: serviceNetPrice,
            priceCurrencyCode: rubCurrencyCode(),
            expiredAt: null,
            realization: null,
          },
          tx,
        );
      } else {
        if (!carId) {
          throw new BadRequestException('Не указан автомобиль для рекомендации');
        }
        if (!workerId) {
          throw new BadRequestException('Не удалось определить сотрудника');
        }

        if (recommendation) {
          await this.recommendationService.deleteRecommendation(recommendation.id, tx);
        }

        const createdRecommendation = await this.recommendationService.createRecommendation(
          {
            carId,
            service: orderItem.service!.service,
            workerId,
            expiredAt: null,
            priceAmount: serviceNetPrice,
            priceCurrencyCode: rubCurrencyCode(),
          },
          tx,
        );
        resultRecommendationId = createdRecommendation.id;

        for (const part of workParts) {
          await this.recommendationService.createRecommendationPart(
            {
              recommendationId: resultRecommendationId,
              partId: part.partId,
              quantity: part.quantity,
              priceAmount: this.toNetAmount(
                part.priceAmount ?? null,
                part.discountAmount ?? null,
              ),
              priceCurrencyCode: rubCurrencyCode(),
            },
            tx,
          );
        }
      }

      // Удаление работы — внутри транзакции
      await this.orderItemService.delete(input.orderItemServiceId, true, {
        tx,
        skipValidation: true,
      });

      return resultRecommendationId;
    });

    await this.publishOrderUpdated(order.id);
    // Публикуем обновление рекомендаций
    if (order.carId) {
      await this.publishCarRecommendationsUpdated(order.carId);
    }

    return {
      orderId: order.id,
      orderItemServiceId: input.orderItemServiceId,
      recommendationId: resolvedRecommendationId,
    };
  }
}
