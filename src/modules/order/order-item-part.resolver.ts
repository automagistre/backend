import { Int, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { OrderItemPartModel } from './models/order-item-part.model';
import { ReservationService } from '../reservation/reservation.service';

@Resolver(() => OrderItemPartModel)
export class OrderItemPartResolver {
  constructor(private readonly reservationService: ReservationService) {}

  @ResolveField(() => Int, { name: 'reservedQuantity' })
  async reservedQuantity(@Parent() part: OrderItemPartModel): Promise<number> {
    return this.reservationService.getTotalReserved(part.id);
  }
}

