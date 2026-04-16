import { Inject, Injectable } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { McEquipmentService } from '../mc/mc-equipment.service';
import { OrderItemService } from '../order/order-item.service';
import { OrderService } from '../order/order.service';
import { CarEngineTypeShortLabel } from '../vehicle/enums/car-engine-type.enum';
import { CarTransmissionShortLabel } from '../vehicle/enums/car-transmission.enum';
import { CarWheelDriveShortLabel } from '../vehicle/enums/car-wheel-drive.enum';
import { MaintenanceTemplateModel } from './models/maintenance-template.model';
import type { AuthContext } from 'src/common/user-id.store';

function buildMaintenanceTemplateLabel(equipment: {
  period: number;
  equipmentEngineName: string | null;
  equipmentEngineCapacity: string;
  equipmentEngineType: number;
  equipmentTransmission: number;
  equipmentWheelDrive: number;
}): string {
  const parts: string[] = [];
  const engineParts: string[] = [];
  if (equipment.equipmentEngineName?.trim()) {
    engineParts.push(equipment.equipmentEngineName.trim());
  }
  if (equipment.equipmentEngineCapacity?.trim()) {
    engineParts.push(equipment.equipmentEngineCapacity.trim() + 'л');
  }
  if (equipment.equipmentEngineType !== 0) {
    engineParts.push(
      CarEngineTypeShortLabel[equipment.equipmentEngineType] ?? '?',
    );
  }
  if (engineParts.length > 0) {
    parts.push(engineParts.join(' '));
  }
  if (equipment.equipmentTransmission !== 0) {
    parts.push(
      CarTransmissionShortLabel[equipment.equipmentTransmission] ?? '?',
    );
  }
  if (equipment.equipmentWheelDrive !== 0) {
    parts.push(CarWheelDriveShortLabel[equipment.equipmentWheelDrive] ?? '?');
  }
  return parts.join(' · ');
}

@Injectable()
export class TemplateService {
  constructor(
    private readonly mcEquipmentService: McEquipmentService,
    private readonly orderItemService: OrderItemService,
    private readonly orderService: OrderService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  async getMaintenanceTemplates(
    ctx: AuthContext,
    carId: string,
  ): Promise<MaintenanceTemplateModel[]> {
    const list = await this.mcEquipmentService.findAllByCar(ctx, carId);
    const result: MaintenanceTemplateModel[] = [];
    for (const eq of list) {
      const rawItems = await this.mcEquipmentService.getLinesForEquipment(
        ctx,
        eq.id,
      );
      result.push({
        id: eq.id,
        label: buildMaintenanceTemplateLabel(eq),
        items: rawItems.map((item) => ({
          period: item.period,
          recommended: item.recommended,
          work: {
            name: item.work.name,
            price:
              item.work.priceAmount != null
                ? {
                    amountMinor: item.work.priceAmount,
                    currencyCode: item.work.priceCurrencyCode ?? 'RUB',
                  }
                : null,
          },
          parts: item.parts.map((p) => ({
            partId: p.partId,
            name: p.partName ?? null,
            number: p.partNumber ?? null,
            manufacturer: p.partManufacturerName ?? null,
            quantity: p.quantity,
            price:
              p.priceAmount != null
                ? {
                    amountMinor: p.priceAmount,
                    currencyCode: p.priceCurrencyCode ?? 'RUB',
                  }
                : null,
          })),
        })),
      });
    }
    return result;
  }

  /**
   * Применить шаблон к заказу: добавить переданные работы и запчасти. Без вычислений на бэкенде.
   */
  async applyTemplate(
    ctx: AuthContext,
    input: {
      orderId: string;
      items: Array<{
        work: {
          name: string;
          price?: { amountMinor: bigint; currencyCode?: string | null } | null;
        };
        parts: Array<{
          partId: string;
          quantity: number;
          price?: { amountMinor: bigint; currencyCode?: string | null } | null;
        }>;
      }>;
    },
  ): Promise<void> {
    const { orderId, items } = input;
    await this.orderService.validateOrderEditable(ctx, orderId);
    for (const item of items) {
      const workPrice = item.work.price;
      const serviceItem = await this.orderItemService.createService(ctx, {
        orderId,
        parentId: undefined,
        service: item.work.name,
        warranty: false,
        price:
          workPrice != null
            ? {
                amountMinor: BigInt(workPrice.amountMinor),
                currencyCode: workPrice.currencyCode ?? undefined,
              }
            : undefined,
      });
      if (item.parts.length > 0) {
        await this.orderItemService.createPartsForService(ctx, {
          orderId,
          parentId: serviceItem.id,
          parts: item.parts.map((p) => ({
            partId: p.partId,
            quantity: p.quantity,
            priceAmount:
              p.price != null ? BigInt(p.price.amountMinor) : undefined,
          })),
          validateOrderEditable: false,
        });
      }
    }
    const order = await this.orderService.findOne(ctx, orderId);
    if (order) {
      await this.pubSub.publish(`ORDER_UPDATED_${orderId}`, {
        orderUpdated: { ...order, orderId },
      });
    }
  }
}
