import { Field, ID, InputType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';

@InputType()
export class CreateIncomeInput {
  @IsUUID()
  @Field(() => ID)
  supplierId: string;

  @Field(() => String, { nullable: true, description: 'Номер документа' })
  document?: string | null;
}
