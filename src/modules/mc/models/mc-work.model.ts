import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Работа ТО (справочник)' })
export class McWorkModel {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  name: string;

  @Field(() => String, { nullable: true })
  description: string | null;

  @Field(() => String, { nullable: true })
  comment: string | null;

  @Field(() => String)
  tenantId: string;

  @Field(() => BigInt, { nullable: true, description: 'Цена в минорных единицах (копейки)' })
  priceAmount: bigint | null;

  @Field(() => String, { nullable: true })
  priceCurrencyCode: string | null;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;
}
