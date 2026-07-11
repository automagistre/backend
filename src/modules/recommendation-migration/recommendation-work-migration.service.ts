import {
  Inject,
  Injectable,
  BadRequestException,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderService } from 'src/modules/order/order.service';
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
import type { Prisma } from 'src/generated/prisma/client';
import type { AuthContext } from 'src/common/user-id.store';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import {
  AuditAction,
  AuditEntityType,
} from 'src/modules/audit-log/enums/audit.enums';
import { orderTitle } from 'src/common/utils/entity-title.util';

@Injectable()
export class RecommendationWorkMigrationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
    private readonly orderItemService: OrderItemService,
    private readonly recommendationService: RecommendationService,
    private readonly settingsService: SettingsService,
    private readonly auditLog: AuditLogService,
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

  private resolveRecommendationWorkerPersonId(
    orderAssigneePersonId: string | null,
    serviceWorkerPersonId: string | null,
  ): string | null {
    // order.assigneeId уже personId ответственного — конвертация не нужна.
    return orderAssigneePersonId ?? serviceWorkerPersonId ?? null;
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

    const workerPersonId = order.assigneeId ?? null;

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
        // Подрядная рекомендация реализуется в подрядную работу с исполнителем
        // из поля contractor (executor — диагност, в работу не переносится);
        // своя — на ответственного по заказу. Подрядчик может быть не указан —
        // тогда его выбирают в заказе (закрытие без исполнителя заблокировано).
        const isContractor = recommendation.kind === 'CONTRACTOR';
        const executorKind = isContractor
          ? recommendation.contractorKind
          : workerPersonId
            ? 'PERSON'
            : null;
        const executorId = isContractor
          ? recommendation.contractorId
          : workerPersonId;

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
                  kind: recommendation.kind,
                  executorKind,
                  executorId,
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

          // Реализация — отдельное действие в двух таймлайнах: заказ и машина.
          await this.auditLog.record(tx, ctx, {
            rootEntityType: AuditEntityType.ORDER,
            rootEntityId: input.orderId,
            entityType: AuditEntityType.ORDER_ITEM_SERVICE,
            entityId: serviceItemId,
            action: AuditAction.REALIZE,
            entityDisplayName: recommendation.service,
            metadata: {
              recommendationId,
              carId: recommendation.carId,
            },
          });

          if (recommendation.carId) {
            await this.auditLog.record(tx, ctx, {
              rootEntityType: AuditEntityType.CAR,
              rootEntityId: recommendation.carId,
              entityType: AuditEntityType.CAR_RECOMMENDATION,
              entityId: recommendationId,
              action: AuditAction.REALIZE,
              entityDisplayName: `${recommendation.service} → ${orderTitle(order.number)}`,
              metadata: {
                orderId: input.orderId,
                orderItemServiceId: serviceItemId,
              },
            });
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

  async syncWorkToRecommendation(
    ctx: AuthContext,
    params: {
      orderItemServiceId: string;
      deleteOrderItem?: boolean;
      validateOrderEditable?: boolean;
      tx?: Prisma.TransactionClient;
      publishUpdates?: boolean;
      /** Логировать как явный «Возврат в рекомендации» (одно событие на сторону). */
      auditAsReturn?: boolean;
    },
  ): Promise<{ orderId: string; recommendationId: string; carId: string | null }> {
    const {
      orderItemServiceId,
      deleteOrderItem = true,
      validateOrderEditable = true,
      tx,
      publishUpdates = tx == null,
      auditAsReturn = false,
    } = params;
    const client = tx ?? this.prisma;
    // В режиме явного возврата вложенные create/update/delete не логируем —
    // вместо них пишем по одному событию RETURN_TO_RECOMMENDATION на сторону.
    const auditNested = !auditAsReturn;

    const orderItem = await client.orderItem.findUnique({
      where: { id: orderItemServiceId },
      include: {
        service: true,
        children: {
          include: { part: true },
        },
      },
    });

    if (!orderItem || !orderItem.service) {
      throw new NotFoundException(`Работа с ID ${orderItemServiceId} не найдена`);
    }

    if (!orderItem.orderId) {
      throw new BadRequestException('Не указан заказ для работы');
    }

    if (validateOrderEditable) {
      await this.orderService.validateOrderEditable(ctx, orderItem.orderId);
    }
    const order = await this.orderService.findOne(ctx, orderItem.orderId);
    if (!order) {
      throw new NotFoundException(`Заказ с ID ${orderItem.orderId} не найден`);
    }

    const recommendation = await client.carRecommendation.findFirst({
      where: {
        realization: orderItemServiceId,
        tenantGroupId: ctx.tenantGroupId,
      },
      include: { parts: true },
    });

    type WorkPart = {
      partId: string;
      quantity: number;
      priceAmount: bigint | null;
      discountAmount: bigint | null;
    };

    const workParts: WorkPart[] = orderItem.children
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
    const assigneePersonId = this.resolveRecommendationWorkerPersonId(
      order.assigneeId ?? null,
      orderItem.service.executorKind === 'PERSON'
        ? (orderItem.service.executorId ?? null)
        : null,
    );

    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    let resultRecommendationId: string;

    // Подрядность и подрядчик синхронизируются из работы; диагност не трогается.
    const isContractorWork = orderItem.service.kind === 'CONTRACTOR';
    const contractorPatch = isContractorWork
      ? {
          contractorKind: orderItem.service.executorKind,
          contractorId: orderItem.service.executorId,
        }
      : { contractorKind: null, contractorId: null };

    if (recommendation && sameComposition) {
      resultRecommendationId = recommendation.id;
      const workPartsByPartId = new Map<string, WorkPart>(
        workParts.map((part) => [part.partId, part]),
      );

      await this.recommendationService.updateRecommendation(
        ctx,
        {
          id: recommendation.id,
          service: orderItem.service.service,
          kind: orderItem.service.kind,
          ...contractorPatch,
          priceAmount: serviceNetPrice,
          priceCurrencyCode: defaultCurrency,
          expiredAt: null,
          realization: null,
        },
        client,
        auditNested,
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
          client,
          auditNested,
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
          service: orderItem.service.service,
          kind: orderItem.service.kind,
          ...contractorPatch,
          priceAmount: serviceNetPrice,
          priceCurrencyCode: defaultCurrency,
          expiredAt: null,
          realization: null,
        },
        client,
        auditNested,
      );
    } else {
      // Диагностом становится ответственный по заказу; исполнитель подрядной
      // работы уходит в поле contractor.
      if (!carId) {
        throw new BadRequestException('Не указан автомобиль для рекомендации');
      }
      if (!isContractorWork && !assigneePersonId) {
        throw new BadRequestException('Не удалось определить сотрудника');
      }

      if (recommendation) {
        await this.recommendationService.deleteRecommendation(
          ctx,
          recommendation.id,
          client,
          auditNested,
        );
      }

      const createdRecommendation =
        await this.recommendationService.createRecommendation(
          ctx,
          {
            carId,
            service: orderItem.service.service,
            kind: orderItem.service.kind,
            executorKind: assigneePersonId ? 'PERSON' : null,
            executorId: assigneePersonId,
            ...contractorPatch,
            expiredAt: null,
            priceAmount: serviceNetPrice,
            priceCurrencyCode: defaultCurrency,
          },
          client,
          auditNested,
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
          client,
          auditNested,
        );
      }
    }

    if (auditAsReturn) {
      await this.auditLog.record(client, ctx, {
        rootEntityType: AuditEntityType.ORDER,
        rootEntityId: order.id,
        entityType: AuditEntityType.ORDER_ITEM_SERVICE,
        entityId: orderItemServiceId,
        action: AuditAction.RETURN_TO_RECOMMENDATION,
        entityDisplayName: orderItem.service.service,
        metadata: { recommendationId: resultRecommendationId, carId },
      });

      if (carId) {
        await this.auditLog.record(client, ctx, {
          rootEntityType: AuditEntityType.CAR,
          rootEntityId: carId,
          entityType: AuditEntityType.CAR_RECOMMENDATION,
          entityId: resultRecommendationId,
          action: AuditAction.RETURN_TO_RECOMMENDATION,
          entityDisplayName: `${orderItem.service.service} ← ${orderTitle(order.number)}`,
          metadata: { orderId: order.id, orderItemServiceId },
        });
      }
    }

    if (deleteOrderItem) {
      await this.orderItemService.delete(ctx, orderItemServiceId, true, {
        tx: client,
        skipValidation: true,
        skipAudit: auditAsReturn,
      });
    }

    if (publishUpdates) {
      await this.publishOrderUpdated(ctx, order.id);
      if (order.carId) {
        await this.publishCarRecommendationsUpdated(ctx, order.carId);
      }
    }

    return {
      orderId: order.id,
      recommendationId: resultRecommendationId,
      carId: order.carId ?? null,
    };
  }

  async returnWorkToRecommendation(
    ctx: AuthContext,
    input: ReturnWorkToRecommendationInput,
  ): Promise<ReturnWorkToRecommendationPayload> {
    const result = await this.syncWorkToRecommendation(ctx, {
      orderItemServiceId: input.orderItemServiceId,
      deleteOrderItem: true,
      validateOrderEditable: true,
      publishUpdates: true,
      auditAsReturn: true,
    });

    return {
      orderId: result.orderId,
      orderItemServiceId: input.orderItemServiceId,
      recommendationId: result.recommendationId,
    };
  }
}
