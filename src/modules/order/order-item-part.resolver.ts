import { Int, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { OrderItemPartModel } from './models/order-item-part.model';
import { ReservationService } from '../reservation/reservation.service';
import { AppUserModel } from '../app-user/models/app-user.model';
import { AppUserLoader } from '../app-user/app-user.loader';
import { OrderItemServiceModel } from './models/order-item-service.model';
import { OrderItemGroupModel } from './models/order-item-group.model';

@Resolver(() => OrderItemPartModel)
export class OrderItemPartResolver {
  constructor(
    private readonly reservationService: ReservationService,
    private readonly appUserLoader: AppUserLoader,
  ) {}

  @ResolveField(() => Int, { name: 'reservedQuantity' })
  async reservedQuantity(@Parent() part: OrderItemPartModel): Promise<number> {
    return this.reservationService.getTotalReserved(part.id);
  }

  @ResolveField(() => AppUserModel, { nullable: true })
  async createdByUser(@Parent() part: OrderItemPartModel) {
    if (!part.createdBy) return null;
    return this.appUserLoader.load(part.createdBy);
  }
}

@Resolver(() => OrderItemServiceModel)
export class OrderItemServiceResolver {
  constructor(private readonly appUserLoader: AppUserLoader) {}

  @ResolveField(() => AppUserModel, { nullable: true })
  async createdByUser(@Parent() service: OrderItemServiceModel) {
    if (!service.createdBy) return null;
    return this.appUserLoader.load(service.createdBy);
  }
}

@Resolver(() => OrderItemGroupModel)
export class OrderItemGroupResolver {
  constructor(private readonly appUserLoader: AppUserLoader) {}

  @ResolveField(() => AppUserModel, { nullable: true })
  async createdByUser(@Parent() group: OrderItemGroupModel) {
    if (!group.createdBy) return null;
    return this.appUserLoader.load(group.createdBy);
  }
}
