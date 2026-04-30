import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('SiteReview')
export class WwwReview {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  author: string;

  @Field(() => String)
  text: string;

  @Field(() => String, {
    description: 'Источник: club | yandex | google | two_gis | yell',
  })
  source: string;

  @Field(() => Date)
  publishAt: Date;
}

@ObjectType('SitePageInfo')
export class WwwPageInfo {
  @Field(() => String, { nullable: true })
  endCursor: string | null;

  @Field(() => Boolean)
  hasNextPage: boolean;
}

@ObjectType('SiteReviewConnection')
export class WwwReviewConnection {
  @Field(() => [WwwReview])
  nodes: WwwReview[];

  @Field(() => WwwPageInfo)
  pageInfo: WwwPageInfo;

  @Field(() => Int)
  totalCount: number;
}
