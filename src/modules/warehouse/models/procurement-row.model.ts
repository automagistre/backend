import { Field, Int, ObjectType } from '@nestjs/graphql';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ProcurementStatus } from '../enums/procurement-status.enum';

@ObjectType()
export class ProcurementRowModel {
  @IsUUID()
  @Field(() => String)
  partId: string;

  @IsString()
  @Field(() => String)
  partName: string;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  partNumber: string | null;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  manufacturerName: string | null;

  @IsInt()
  @Field(() => Int)
  stockQuantity: number;

  @IsInt()
  @Min(0)
  @Field(() => Int, {
    description: 'В заказах, но не в резерве',
  })
  inOrdersNotReserved: number;

  @IsInt()
  @Min(0)
  @Field(() => Int)
  reservedQuantity: number;

  @IsInt()
  @Min(0)
  @Field(() => Int, {
    description: 'Ожидаемые поставки',
  })
  inSupply: number;

  @IsInt()
  @Min(0)
  @Field(() => Int)
  needToOrder: number;

  @IsEnum(ProcurementStatus)
  @Field(() => ProcurementStatus)
  status: ProcurementStatus;

  @Field(() => Boolean, {
    description: 'Есть поставка с задержкой (updatedAt старше supplyExpiryDays дней)',
  })
  hasDelayedSupply: boolean;
}
