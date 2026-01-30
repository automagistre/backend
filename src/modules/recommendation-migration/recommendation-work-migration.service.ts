import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderService } from 'src/modules/order/order.service';
import { EmployeeService } from 'src/modules/employee/employee.service';
import { PubSub } from 'graphql-subscriptions';
import { RealizeCarRecommendationInput } from 'src/modules/recommendation-migration/inputs/realize-car-recommendation.input';
import { RealizeCarRecommendationPayload } from 'src/modules/recommendation-migration/models/realize-car-recommendation.payload';
import { OrderItemService } from 'src/modules/order/order-item.service';
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
    let workerPersonId: string | null = null;
    if (order.workerId) {
      const employee = await this.employeeService.findOne(order.workerId);
      workerPersonId = employee?.personId ?? null;
    }

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

        await this.orderItemService.reservePartsBestEffort(
          createdParts,
          order.tenantId,
        );

        results.push({
          orderId: input.orderId,
          orderItemServiceId: serviceItemId,
          recommendationId,
        });
      } catch {
        // best-effort: продолжаем обработку остальных рекомендаций
        // TODO: собирать ошибки и возвращать в payload, чтобы клиент знал, какие рекомендации не обработались
      }
    }

    if (results.length > 0) {
      await this.publishOrderUpdated(input.orderId);
    }

    return results;
  }
}
