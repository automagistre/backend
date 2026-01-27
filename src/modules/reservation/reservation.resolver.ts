import { Inject } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ReservationService } from './reservation.service';
import { ReservationModel } from './models/reservation.model';
import { ReservePartInput } from './inputs/reserve-part.input';
import { PartReservationSourceModel } from './models/part-reservation-source.model';
import { TransferReservationInput } from './inputs/transfer-reservation.input';
import { PubSub } from 'graphql-subscriptions';
import { OrderService } from '../order/order.service';

@Resolver(() => ReservationModel)
export class ReservationResolver {
  constructor(
    private readonly reservationService: ReservationService,
    private readonly orderService: OrderService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  private async publishOrderUpdated(orderId: string | null): Promise<void> {
    if (!orderId) return;
    const order = await this.orderService.findOne(orderId);
    if (!order) return;

    await this.pubSub.publish(`ORDER_UPDATED_${orderId}`, {
      orderUpdated: {
        ...order,
        orderId,
      },
    });
  }

  @Query(() => [ReservationModel], {
    name: 'reservations',
    description: 'Резервации для элемента заказа',
  })
  async getReservations(
    @Args('orderItemPartId', { type: () => ID }) orderItemPartId: string,
  ): Promise<ReservationModel[]> {
    const reservations =
      await this.reservationService.getByOrderItemPart(orderItemPartId);
    return reservations.map((r) => ({
      id: r.id,
      orderItemPartId: r.orderItemPartId,
      quantity: r.quantity,
      tenantId: r.tenantId,
      createdAt: r.createdAt,
      createdBy: r.createdBy,
    }));
  }

  @Query(() => Number, {
    name: 'totalReserved',
    description: 'Общее количество зарезервированных единиц',
  })
  async getTotalReserved(
    @Args('orderItemPartId', { type: () => ID }) orderItemPartId: string,
  ): Promise<number> {
    return this.reservationService.getTotalReserved(orderItemPartId);
  }

  @Query(() => Int, {
    name: 'partReservable',
    description:
      'Доступно к резерву по запчасти (склад - резервы в активных заказах)',
  })
  async partReservable(
    @Args('partId', { type: () => ID }) partId: string,
    @Args('tenantId', { type: () => ID, nullable: true }) tenantId?: string,
  ): Promise<number> {
    return this.reservationService.getReservable(partId, tenantId);
  }

  @Query(() => [PartReservationSourceModel], {
    name: 'partReservationSources',
    description: 'Источники резерва по запчасти (для сценария "занять")',
  })
  async partReservationSources(
    @Args('partId', { type: () => ID }) partId: string,
    @Args('excludeOrderId', { type: () => ID, nullable: true })
    excludeOrderId?: string,
    @Args('tenantId', { type: () => ID, nullable: true }) tenantId?: string,
  ): Promise<PartReservationSourceModel[]> {
    const sources = await this.reservationService.getReservationSources(
      partId,
      excludeOrderId,
      tenantId,
    );
    return sources.map((s) => ({
      orderId: s.orderId,
      orderNumber: s.orderNumber,
      orderStatus: s.orderStatus as any,
      orderItemPartId: s.orderItemPartId,
      reservedQuantity: s.reservedQuantity,
    }));
  }

  @Mutation(() => ReservationModel, {
    name: 'reservePart',
    description: 'Зарезервировать запчасть',
  })
  async reservePart(
    @Args('input') input: ReservePartInput,
  ): Promise<ReservationModel> {
    const reservation = await this.reservationService.reserve({
      orderItemPartId: input.orderItemPartId,
      quantity: input.quantity,
      tenantId: input.tenantId,
    });
    await this.publishOrderUpdated(
      await this.reservationService.getOrderIdByOrderItemPartId(
        input.orderItemPartId,
      ),
    );
    return {
      id: reservation.id,
      orderItemPartId: reservation.orderItemPartId,
      quantity: reservation.quantity,
      tenantId: reservation.tenantId,
      createdAt: reservation.createdAt,
      createdBy: reservation.createdBy,
    };
  }

  @Mutation(() => Number, {
    name: 'releaseReservation',
    description: 'Снять резерв с запчасти',
  })
  async releaseReservation(
    @Args('orderItemPartId', { type: () => ID }) orderItemPartId: string,
    @Args('quantity', { type: () => Number, nullable: true }) quantity?: number,
  ): Promise<number> {
    const result = await this.reservationService.release({
      orderItemPartId,
      quantity,
    });
    await this.publishOrderUpdated(
      await this.reservationService.getOrderIdByOrderItemPartId(orderItemPartId),
    );
    return result;
  }

  @Mutation(() => Boolean, {
    name: 'transferReservation',
    description: 'Перенести резерв между позициями заказов (сценарий "занять")',
  })
  async transferReservation(
    @Args('input') input: TransferReservationInput,
  ): Promise<boolean> {
    const { fromOrderId, toOrderId } =
      await this.reservationService.transferReservation({
      fromOrderItemPartId: input.fromOrderItemPartId,
      toOrderItemPartId: input.toOrderItemPartId,
      quantity: input.quantity,
      tenantId: input.tenantId,
    });
    // Причина: изменяются оба заказа — источник и получатель.
    await this.publishOrderUpdated(fromOrderId);
    if (toOrderId !== fromOrderId) {
      await this.publishOrderUpdated(toOrderId);
    }
    return true;
  }
}
