import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ReviewModel } from './models/review.model';
import { ReviewService } from './review.service';
import { CreateReviewInput } from './inputs/create-review.input';
import { UpdateReviewInput } from './inputs/update-review.input';
import { PaginationArgs } from 'src/common/pagination.args';
import { PaginatedReviews } from './types/paginated-reviews.type';

@Resolver(() => ReviewModel)
export class ReviewResolver {
  constructor(private readonly reviewService: ReviewService) {}

  @Query(() => PaginatedReviews, {
    name: 'reviews',
    description: 'Список отзывов',
  })
  async reviews(
    @Args() pagination?: PaginationArgs,
    @Args('search', { nullable: true }) search?: string,
    @Args('source', { nullable: true }) source?: number,
  ) {
    const { take = 25, skip = 0 } = pagination ?? {};
    return this.reviewService.findMany({ take, skip, search, source });
  }

  @Query(() => ReviewModel, {
    name: 'review',
    nullable: true,
    description: 'Отзыв по ID',
  })
  async review(@Args('id') id: string) {
    return this.reviewService.findOne(id);
  }

  @Mutation(() => ReviewModel, {
    name: 'createReview',
    description: 'Создать отзыв',
  })
  async createReview(@Args('input') input: CreateReviewInput) {
    return this.reviewService.create(input);
  }

  @Mutation(() => ReviewModel, {
    name: 'updateReview',
    description: 'Обновить отзыв',
  })
  async updateReview(@Args('input') input: UpdateReviewInput) {
    return this.reviewService.update(input);
  }

  @Mutation(() => ReviewModel, {
    name: 'deleteReview',
    description: 'Удалить отзыв',
  })
  async deleteReview(@Args('id') id: string) {
    return this.reviewService.remove(id);
  }
}