import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';
import { OrderMotivationModel } from '../models/order-motivation.model';
import { MotivationAccrualService } from './motivation-accrual.service';

// TODO(роли): расшифровка чужих бонусов с продаж и ручное начисление — не всем пользователям тенанта
@Resolver()
@RequireTenant()
export class MotivationAccrualResolver {
  constructor(private readonly accruals: MotivationAccrualService) {}

  @Query(() => OrderMotivationModel, {
    description:
      'Бонус с продаж по заказу: прогноз на открытом, начисление на закрытом. Прогноз ничего не пишет',
  })
  orderMotivation(
    @AuthContext() ctx: AuthContextType,
    @Args('orderId', { type: () => ID }) orderId: string,
  ): Promise<OrderMotivationModel> {
    return this.accruals.orderMotivation(ctx, orderId);
  }

  @Mutation(() => OrderMotivationModel, {
    description:
      'Начислить бонус с продаж по закрытому заказу, если при закрытии не начислился. Идемпотентно',
  })
  async chargeOrderMotivation(
    @AuthContext() ctx: AuthContextType,
    @Args('orderId', { type: () => ID }) orderId: string,
  ): Promise<OrderMotivationModel> {
    await this.accruals.chargeByOrder(ctx, orderId);
    return this.accruals.orderMotivation(ctx, orderId);
  }
}
