import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ReviewModel } from './models/review.model';
import { ReviewService } from './review.service';
import { CreateReviewInput } from './inputs/create-review.input';
import { UpdateReviewInput } from './inputs/update-review.input';
import { PaginationArgs } from 'src/common/pagination.args';
import { PaginatedReviews } from './types/paginated-reviews.type';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';

@Resolver(() => ReviewModel)
@RequireTenant()
export class ReviewResolver {
  constructor(private readonly reviewService: ReviewService) {}

  @Query(() => PaginatedReviews, {
    name: 'reviews',
    description: 'Список отзывов',
  })
  async reviews(
    @AuthContext() ctx: AuthContextType,
    @Args() pagination?: PaginationArgs,
    @Args('search', { type: () => String, nullable: true }) search?: string,
    @Args('source', { type: () => Number, nullable: true }) source?: number,
  ) {
    const { take = 25, skip = 0 } = pagination ?? {};
    return this.reviewService.findMany(ctx, { take, skip, search, source });
  }

  @Query(() => ReviewModel, {
    name: 'review',
    nullable: true,
    description: 'Отзыв по ID',
  })
  async review(@AuthContext() ctx: AuthContextType, @Args('id') id: string) {
    return this.reviewService.findOne(ctx, id);
  }

  @Mutation(() => ReviewModel, {
    name: 'createReview',
    description: 'Создать отзыв',
  })
  async createReview(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: CreateReviewInput,
  ) {
    return this.reviewService.create(ctx, input);
  }

  @Mutation(() => ReviewModel, {
    name: 'updateReview',
    description: 'Обновить отзыв',
  })
  async updateReview(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: UpdateReviewInput,
  ) {
    return this.reviewService.update(ctx, input);
  }

  @Mutation(() => ReviewModel, {
    name: 'deleteReview',
    description: 'Удалить отзыв',
  })
  async deleteReview(
    @AuthContext() ctx: AuthContextType,
    @Args('id') id: string,
  ) {
    return this.reviewService.remove(ctx, id);
  }
}