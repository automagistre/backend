import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ReservationService } from './reservation.service';
import { ReservationModel } from './models/reservation.model';
import { ReservePartInput } from './inputs/reserve-part.input';

@Resolver(() => ReservationModel)
export class ReservationResolver {
  constructor(private readonly reservationService: ReservationService) {}

  @Query(() => [ReservationModel], { name: 'reservations', description: 'Резервации для элемента заказа' })
  async getReservations(
    @Args('orderItemPartId', { type: () => ID }) orderItemPartId: string,
  ): Promise<ReservationModel[]> {
    const reservations = await this.reservationService.getByOrderItemPart(orderItemPartId);
    return reservations.map((r) => ({
      id: r.id,
      orderItemPartId: r.orderItemPartId,
      quantity: r.quantity,
      tenantId: r.tenantId,
      createdAt: r.createdAt,
      createdBy: r.createdBy,
    }));
  }

  @Query(() => Number, { name: 'totalReserved', description: 'Общее количество зарезервированных единиц' })
  async getTotalReserved(
    @Args('orderItemPartId', { type: () => ID }) orderItemPartId: string,
  ): Promise<number> {
    return this.reservationService.getTotalReserved(orderItemPartId);
  }

  @Mutation(() => ReservationModel, { name: 'reservePart', description: 'Зарезервировать запчасть' })
  async reservePart(@Args('input') input: ReservePartInput): Promise<ReservationModel> {
    const reservation = await this.reservationService.reserve({
      orderItemPartId: input.orderItemPartId,
      quantity: input.quantity,
      tenantId: input.tenantId,
    });
    return {
      id: reservation.id,
      orderItemPartId: reservation.orderItemPartId,
      quantity: reservation.quantity,
      tenantId: reservation.tenantId,
      createdAt: reservation.createdAt,
      createdBy: reservation.createdBy,
    };
  }

  @Mutation(() => Number, { name: 'releaseReservation', description: 'Снять резерв с запчасти' })
  async releaseReservation(
    @Args('orderItemPartId', { type: () => ID }) orderItemPartId: string,
    @Args('quantity', { type: () => Number, nullable: true }) quantity?: number,
  ): Promise<number> {
    return this.reservationService.release({ orderItemPartId, quantity });
  }
}
