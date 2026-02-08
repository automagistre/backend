import { InputType, Field } from '@nestjs/graphql';
import { IsUUID, IsInt, Min, Max } from 'class-validator';

@InputType()
export class GetAppealDetailInput {
  @Field()
  @IsUUID()
  id: string;

  @Field(() => Number)
  @IsInt()
  @Min(1)
  type: number;
}
