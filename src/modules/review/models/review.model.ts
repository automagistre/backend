import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

@ObjectType({ description: 'Отзыв' })
export class ReviewModel {
  @Field(() => ID)
  id: string;

  @Field(() => String, { description: 'ID в источнике' })
  sourceId: string;

  @Field(() => Int, { description: 'Код источника (1–5)' })
  source: number;

  @Field(() => String, { description: 'Автор' })
  author: string;

  @Field(() => String, { description: 'Текст отзыва' })
  text: string;

  @Field(() => Int, { description: 'Оценка (1–5)' })
  rating: number;

  @Field(() => Date, { description: 'Дата публикации' })
  publishAt: Date;

  @Field(() => GraphQLJSON, { nullable: true, description: 'Сырые данные источника (Yell: link, score, user и т.д.)' })
  raw: unknown;

  @Field(() => String)
  tenantId: string;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  createdBy: string | null;
}
