import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { OrderItemProfitModel } from './models/order-item-profit.model';

type OrderItemProfitRow = OrderItemProfitModel & {
  orderItem?: {
    service?: { service: string } | null;
    part?: { part?: { name: string } | null } | null;
  } | null;
};

@Resolver(() => OrderItemProfitModel)
export class OrderItemProfitResolver {
  @ResolveField(() => String, {
    description: 'Название работы или запчасти',
  })
  lineDisplayName(@Parent() row: OrderItemProfitRow): string {
    const serviceName = row.orderItem?.service?.service?.trim();
    if (serviceName) {
      return serviceName;
    }

    const partName = row.orderItem?.part?.part?.name?.trim();
    if (partName) {
      return partName;
    }

    return '—';
  }
}
