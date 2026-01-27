import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { PartModel } from 'src/modules/part/models/part.model';
import { OrganizationModel } from 'src/modules/organization/models/organization.model';

@ObjectType({ description: 'Запчасть в заказе' })
export class OrderItemPartModel {
  @Field(() => ID)
  id: string;

  @Field(() => PartModel)
  part: PartModel;

  @Field(() => ID)
  partId: string;

  @Field(() => OrganizationModel, { nullable: true })
  supplier: OrganizationModel | null;

  @Field(() => ID, { nullable: true })
  supplierId: string | null;

  @Field(() => Int)
  quantity: number;

  @Field(() => Boolean)
  warranty: boolean;

  @Field(() => BigInt, { nullable: true })
  priceAmount: bigint | null;

  @Field(() => String, { nullable: true })
  priceCurrencyCode: string | null;

  @Field(() => BigInt, { nullable: true })
  discountAmount: bigint | null;

  @Field(() => String, { nullable: true })
  discountCurrencyCode: string | null;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  @Field(() => ID, { nullable: true })
  createdBy: string | null;

  @Field(() => Int, {
    description:
      'Количество в резерве по этой позиции (сумма резерва по orderItemPartId)',
  })
  reservedQuantity?: number;
}
