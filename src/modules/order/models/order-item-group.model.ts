import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Группа элементов заказа' })
export class OrderItemGroupModel {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  name: string;

  @Field(() => Boolean)
  hideParts: boolean;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  @Field(() => ID, { nullable: true })
  createdBy: string | null;
}

