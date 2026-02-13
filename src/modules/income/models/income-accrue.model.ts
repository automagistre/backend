import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class IncomeAccrueModel {
  @Field(() => Date, { nullable: true })
  createdAt?: Date | null;
}
