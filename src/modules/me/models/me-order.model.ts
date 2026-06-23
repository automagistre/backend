import { ArgsType, Field, ID, Int, ObjectType } from '@nestjs/graphql';
import type { Order } from 'src/generated/prisma/client';
import { OrderStatus } from 'src/modules/order/enums/order-status.enum';
import { MeCar, toMeCar } from './me-car.model';

/**
 * Заказ клиента — урезанный shape для LK.
 * Тяжёлые поля (items, payments, etc.) сюда сознательно не входят —
 * для них появятся отдельные resolveField'ы / детальная query.
 */
@ObjectType('MeOrder')
export class MeOrder {
  @Field(() => ID)
  id!: string;

  @Field(() => Int, { description: 'Номер заказа в рамках tenant' })
  number!: number;

  @Field(() => OrderStatus)
  status!: OrderStatus;

  @Field(() => Date, { nullable: true, description: 'Дата создания заказа' })
  createdAt!: Date | null;

  @Field(() => Int, {
    nullable: true,
    description: 'Пробег на момент заказа',
  })
  mileage!: number | null;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => MeCar, { nullable: true, description: 'Автомобиль заказа' })
  car!: MeCar | null;
}

type OrderWithCar = Order & {
  car:
    | (NonNullable<Parameters<typeof toMeCar>[0]>)
    | null;
};

export function toMeOrder(order: OrderWithCar): MeOrder {
  return {
    id: order.id,
    number: order.number,
    status: order.status as OrderStatus,
    createdAt: order.createdAt ?? null,
    mileage: order.mileage ?? null,
    description: order.description ?? null,
    car: order.car ? toMeCar(order.car) : null,
  };
}

@ObjectType('MeOrderList')
export class MeOrderList {
  @Field(() => [MeOrder])
  items!: MeOrder[];

  @Field(() => Int)
  total!: number;
}

@ArgsType()
export class MeOrdersArgs {
  /**
   * Заказы клиента всегда смотрятся в контексте конкретной машины
   * (так устроен UI личного кабинета).
   */
  @Field(() => ID)
  carId!: string;

  @Field(() => Int, { nullable: true, defaultValue: 25 })
  take?: number;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  skip?: number;

  /**
   * `true` — только закрытые/отменённые (страница «История»),
   * `false` — активные (страница «Текущие»),
   * `null/undefined` — все.
   */
  @Field(() => Boolean, { nullable: true })
  closed?: boolean | null;
}
