import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsUUID, Min } from 'class-validator';

@InputType()
export class CancelPartSupplyInput {
  @IsUUID()
  @Field(() => ID)
  partId: string;

  @IsUUID()
  @Field(() => ID)
  supplierId: string;

  @IsInt()
  @Min(1)
  @Field(() => Int)
  quantity: number;
}
