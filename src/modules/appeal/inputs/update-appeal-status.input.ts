import { InputType, Field } from '@nestjs/graphql';
import { IsUUID, IsInt, Min, Max } from 'class-validator';

@InputType()
export class UpdateAppealStatusInput {
  @Field()
  @IsUUID()
  appealId: string;

  @Field(() => Number)
  @IsInt()
  @Min(1)
  status: number;
}
