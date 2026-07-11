import { Field, ID, InputType } from '@nestjs/graphql';
import { IsOptional, IsUUID, Length } from 'class-validator';
import { MoneyInput } from 'src/common/inputs/money.input';
import { ExecutorInput } from 'src/common/party';
import { OrderItemServiceKind } from 'src/modules/order/enums/order-item-service-kind.enum';

@InputType()
export class UpdateCarRecommendationInput {
  @Field(() => ID)
  @IsUUID()
  id: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Length(1, 255)
  service?: string | null;

  @Field(() => OrderItemServiceKind, { nullable: true })
  @IsOptional()
  kind?: OrderItemServiceKind | null;

  @Field(() => ExecutorInput, {
    nullable: true,
    description: 'Диагност — кто порекомендовал (всегда персона)',
  })
  @IsOptional()
  executor?: ExecutorInput | null;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Диагностика проведена не нами — диагност очищается',
  })
  @IsOptional()
  externalDiagnostic?: boolean | null;

  @Field(() => ExecutorInput, {
    nullable: true,
    description: 'Будущий исполнитель-подрядчик (только для kind=CONTRACTOR)',
  })
  @IsOptional()
  contractor?: ExecutorInput | null;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  expiredAt?: Date | null;

  @Field(() => MoneyInput, { nullable: true })
  @IsOptional()
  price?: MoneyInput;
}
