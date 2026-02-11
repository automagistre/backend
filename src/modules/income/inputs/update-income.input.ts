import { Field, ID, InputType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';

@InputType()
export class UpdateIncomePartInput {
  @IsUUID()
  @Field(()=> ID)
  income_id: string

  @Field(() => String, { nullable: true, description: 'Номер документа' })
  document?: string | null;
}
