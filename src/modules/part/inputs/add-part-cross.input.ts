import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class AddPartCrossInput {
  @Field(() => ID, { description: 'ID запчасти' })
  partId: string;

  @Field(() => ID, { description: 'ID взаимозаменяемой запчасти' })
  crossPartId: string;
}
