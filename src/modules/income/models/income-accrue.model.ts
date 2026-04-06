import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class IncomeAccrueModel {
  @Field(() => Date, { nullable: true })
  createdAt?: Date | null;

  @Field(() => ID, { nullable: true })
  createdBy?: string | null;
}
