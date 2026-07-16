import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { MoneyModel } from 'src/common/models/money.model';
import { TireSeason } from '../enums/tire-season.enum';
import { TireStorageStatus } from '../enums/tire-storage-status.enum';

@ObjectType({ description: 'Договор сезонного хранения шин/дисков' })
export class TireStorageModel {
  @Field(() => ID)
  id: string;

  @Field(() => Int)
  number: number;

  @Field(() => ID)
  tenantGroupId: string;

  @Field(() => ID)
  customerId: string;

  @Field(() => ID, { nullable: true })
  carId: string | null;

  @Field(() => ID, { nullable: true })
  orderId: string | null;

  @Field(() => MoneyModel, { description: 'Сумма договора хранения' })
  amount: MoneyModel;

  @Field(() => Int)
  width: number;

  @Field(() => Int)
  height: number;

  @Field(() => Int)
  radius: number;

  @Field(() => String)
  manufacturer: string;

  @Field(() => Int)
  quantity: number;

  @Field(() => Boolean)
  onDisks: boolean;

  @Field(() => TireSeason)
  season: TireSeason;

  @Field(() => TireStorageStatus)
  status: TireStorageStatus;

  @Field(() => Date, { nullable: true })
  acceptedAt: Date | null;

  @Field(() => Date, { nullable: true })
  expiresAt: Date | null;

  @Field(() => Date, { nullable: true })
  closedAt: Date | null;

  @Field(() => ID, { nullable: true })
  closedById: string | null;

  @Field(() => String, { nullable: true })
  note: string | null;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  @Field(() => ID, { nullable: true })
  createdBy: string | null;

  @Field(() => Boolean, {
    description: 'Просрочен (IN_WAREHOUSE/AWAITING_SHOP/IN_SHOP и expiresAt < now)',
  })
  isOverdue: boolean;
}
