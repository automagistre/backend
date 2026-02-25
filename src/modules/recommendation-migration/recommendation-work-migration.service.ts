import {
  Inject,
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
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
import { normalizeMoneyAmount } from 'src/common/utils/money.util';
import { SettingsService } from 'src/modules/settings/settings.service';
import { v6 as uuidv6 } from 'uuid';
import type { AuthContext } from 'src/common/user-id.store';

@Injectable()
export class RecommendationWorkMigrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
    private readonly orderItemService: OrderItemService,
    private readonly employeeService: EmployeeService,
    private readonly recommendationService: RecommendationService,
    private readonly settingsService: SettingsService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  private async publishOrderUpdated(
    ctx: AuthContext,
    orderId: string,
  ): Promise<void> {
    const order = await this.orderService.findOne(ctx, orderId);
    if (!order) return;

    await this.pubSub.publish(`ORDER_UPDATED_${orderId}`, {
      orderUpdated: {
        ...order,
        orderId,
      },
    });
  }

  private async publishCarRecommendationsUpdated(
    ctx: AuthContext,
    carId: string,
  ): Promise<void> {
    const recommendations = await this.recommendationService.findByCarId(
      ctx,
      carId,
    );
    await this.pubSub.publish(`CAR_RECOMMENDATIONS_UPDATED_${carId}`, {
      carRecommendationsUpdated: recommendations,
      carId,
    });
  }

  private toNetAmount(
    priceAmount?: bigint | null,
    discountAmount?: bigint | null,
  ): bigint {
    const net =
      normalizeMoneyAmount(priceAmount) - normalizeMoneyAmount(discountAmount);
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
    ctx: AuthContext,
    orderWorkerId: string | null,
    serviceWorkerPersonId: string | null,
  ): Promise<string | null> {
    if (orderWorkerId) {
      const personId = await this.employeeService.resolvePersonIdByEmployeeId(
        ctx,
        orderWorkerId,
      );
      return personId ?? serviceWorkerPersonId ?? null;
    }
    return serviceWorkerPersonId ?? null;
  }

  async realizeCarRecommendation(
    ctx: AuthContext,
    input: RealizeCarRecommendationInput,
  ): Promise<RealizeCarRecommendationPayload[]> {
    await this.orderService.validateOrderEditable(ctx, input.orderId);
    const order = await this.orderService.findOne(ctx, input.orderId);
    if (!order) {
      throw new NotFoundException(`Заказ с ID ${input.orderId} не найден`);
    }

    const workerPersonId =
      await this.employeeService.resolvePersonIdByEmployeeId(
        ctx,
        order.workerId ?? null,
      );

    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();

    const results: RealizeCarRecommendationPayload[] = [];

    for (const selection of input.recommendations) {
      try {
        const recommendationId = selection.recommendationId;
        const recommendation = await this.prisma.carRecommendation.findFirst({
          where: { id: recommendationId, tenantGroupId: ctx.tenantGroupId },
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
            : recommendation.parts.filter((part) =>
                selectedPartIds.has(part.id),
              );
        const createdParts = await this.prisma.$transaction(async (tx) => {
          await tx.orderItem.create({
            data: {
              id: serviceItemId,
              orderId: input.orderId,
              parentId: null,
              type: '1',
              tenantId: ctx.tenantId,
              service: {
                create: {
                  service: recommendation.service,
                  workerId: workerPersonId,
                  warranty: false,
                  priceAmount: normalizeMoneyAmount(recommendation.priceAmount),
                  priceCurrencyCode: defaultCurrency,
                  discountAmount: normalizeMoneyAmount(undefined),
                  discountCurrencyCode: defaultCurrency,
                  createdBy: ctx.userId,
                },
              },
            },
          });

          const parts = await this.orderItemService.createPartsForService(
            ctx,
            {
              orderId: input.orderId,
              parentId: serviceItemId,
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

        await this.orderItemService.reservePartsBestEffort(ctx, createdParts);

        results.push({
          orderId: input.orderId,
          orderItemServiceId: serviceItemId,
          recommendationId,
        });

        const carIdToPublish = recommendation.carId ?? order.carId;
        if (carIdToPublish) {
          await this.publishCarRecommendationsUpdated(ctx, carIdToPublish);
        }
      } catch (error) {
        // best-effort: продолжаем обработку остальных рекомендаций
        // TODO: собирать ошибки и возвращать в payload, чтобы клиент знал, какие рекомендации не обработались
        console.error(
          'realizeCarRecommendation error for',
          selection.recommendationId,
          error,
        );
      }
    }

    if (results.length > 0) {
      await this.publishOrderUpdated(ctx, input.orderId);
      if (order.carId) {
        await this.publishCarRecommendationsUpdated(ctx, order.carId);
      }
    }

    return results;
  }

  async returnWorkToRecommendation(
    ctx: AuthContext,
    input: ReturnWorkToRecommendationInput,
  ): Promise<ReturnWorkToRecommendationPayload> {
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

    await this.orderService.validateOrderEditable(ctx, orderItem.orderId);
    const order = await this.orderService.findOne(ctx, orderItem.orderId);
    if (!order) {
      throw new NotFoundException(`Заказ с ID ${orderItem.orderId} не найден`);
    }

    const recommendation = await this.recommendationService.findByRealization(
      ctx,
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
      workParts.map((part) => ({
        partId: part.partId,
        quantity: part.quantity,
      })),
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

    const carId = order.carId ?? recommendation?.carId;
    const workerId = await this.resolveRecommendationWorkerPersonId(
      ctx,
      order.workerId ?? null,
      orderItem.service.workerId ?? null,
    );

    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();

    const resolvedRecommendationId = await this.prisma.$transaction(
      async (tx) => {
        let resultRecommendationId: string;

        if (recommendation && sameComposition) {
          resultRecommendationId = recommendation.id;
          const workPartsByPartId = new Map(
            workParts.map((part) => [part.partId, part]),
          );

          await this.recommendationService.updateRecommendation(
            ctx,
            {
              id: recommendation.id,
              service: orderItem.service!.service,
              priceAmount: serviceNetPrice,
              priceCurrencyCode: defaultCurrency,
              expiredAt: null,
              realization: null,
            },
            tx,
          );

          for (const recPart of recommendation.parts) {
            const workPart = workPartsByPartId.get(recPart.partId);
            if (!workPart) continue;
            await this.recommendationService.updateRecommendationPart(
              ctx,
              {
                id: recPart.id,
                priceAmount: this.toNetAmount(
                  workPart.priceAmount ?? null,
                  workPart.discountAmount ?? null,
                ),
                priceCurrencyCode: defaultCurrency,
              },
              tx,
            );
          }
        } else if (
          recommendation &&
          workParts.length === 0 &&
          isSameServiceName
        ) {
          resultRecommendationId = recommendation.id;
          await this.recommendationService.updateRecommendation(
            ctx,
            {
              id: recommendation.id,
              service: orderItem.service!.service,
              priceAmount: serviceNetPrice,
              priceCurrencyCode: defaultCurrency,
              expiredAt: null,
              realization: null,
            },
            tx,
          );
        } else {
          if (!carId) {
            throw new BadRequestException(
              'Не указан автомобиль для рекомендации',
            );
          }
          if (!workerId) {
            throw new BadRequestException('Не удалось определить сотрудника');
          }

          if (recommendation) {
            await this.recommendationService.deleteRecommendation(
              ctx,
              recommendation.id,
              tx,
            );
          }

          const createdRecommendation =
            await this.recommendationService.createRecommendation(
              ctx,
              {
                carId,
                service: orderItem.service!.service,
                workerId,
                expiredAt: null,
                priceAmount: serviceNetPrice,
                priceCurrencyCode: defaultCurrency,
              },
              tx,
            );
          resultRecommendationId = createdRecommendation.id;

          for (const part of workParts) {
            await this.recommendationService.createRecommendationPart(
              ctx,
              {
                recommendationId: resultRecommendationId,
                partId: part.partId,
                quantity: part.quantity,
                priceAmount: this.toNetAmount(
                  part.priceAmount ?? null,
                  part.discountAmount ?? null,
                ),
                priceCurrencyCode: defaultCurrency,
              },
              tx,
            );
          }
        }

        await this.orderItemService.delete(
          ctx,
          input.orderItemServiceId,
          true,
          {
            tx,
            skipValidation: true,
          },
        );

        return resultRecommendationId;
      },
    );

    await this.publishOrderUpdated(ctx, order.id);
    if (order.carId) {
      await this.publishCarRecommendationsUpdated(ctx, order.carId);
    }

    return {
      orderId: order.id,
      orderItemServiceId: input.orderItemServiceId,
      recommendationId: resolvedRecommendationId,
    };
  }
}
