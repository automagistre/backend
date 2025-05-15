import { ArgsType, Field, ID, Int } from '@nestjs/graphql';

@ArgsType()
export class PaginationArgs {
  @Field(() => Int, { nullable: true, defaultValue: 10 })
  take?: number;

  @Field(() => ID, { nullable: true })
  cursor?: string;
}
