import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateReviewInput } from './inputs/create-review.input';
import { UpdateReviewInput } from './inputs/update-review.input';
import { randomUUID } from 'crypto';
import type { AuthContext } from 'src/common/user-id.store';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;
const DEFAULT_SOURCE_MANUAL = 1; // Manual, как в старой CRM

// TODO: Почистить дубликаты отзывов — 217 записей продублированы во все 3 tenant'а

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    ctx: AuthContext,
    {
      take = DEFAULT_TAKE,
      skip = DEFAULT_SKIP,
      search,
      source,
    }: {
      take?: number;
      skip?: number;
      search?: string;
      source?: number;
    },
  ) {
    const { tenantId } = ctx;
    const where = {
      tenantId,
      ...(search
        ? {
            OR: [
              { author: { contains: search, mode: 'insensitive' as const } },
              { text: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(source != null ? { source } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        take: +take,
        skip: +skip,
        orderBy: { publishAt: 'desc' },
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items, total };
  }

  async findOne(ctx: AuthContext, id: string) {
    const { tenantId } = ctx;
    return this.prisma.review.findFirst({
      where: { id, tenantId },
    });
  }

  async create(ctx: AuthContext, data: CreateReviewInput) {
    const { tenantId, userId } = ctx;
    const source = data.source ?? DEFAULT_SOURCE_MANUAL;
    const sourceId = randomUUID();
    const publishAt = data.publishAt ?? new Date();
    return this.prisma.review.create({
      data: {
        sourceId,
        source,
        author: data.author.trim(),
        text: data.text.trim(),
        rating: data.rating,
        publishAt,
        raw: Prisma.JsonNull,
        tenantId,
        createdBy: userId,
      },
    });
  }

  async update(ctx: AuthContext, input: UpdateReviewInput) {
    const existing = await this.findOne(ctx, input.id);
    if (!existing) throw new NotFoundException('Отзыв не найден');
    const data: {
      author?: string;
      text?: string;
      rating?: number;
      source?: number;
      publishAt?: Date;
    } = {};
    if (input.author !== undefined) data.author = input.author.trim();
    if (input.text !== undefined) data.text = input.text.trim();
    if (input.rating !== undefined) data.rating = input.rating;
    if (input.source !== undefined) data.source = input.source;
    if (input.publishAt !== undefined) data.publishAt = input.publishAt;
    return this.prisma.review.update({
      where: { id: input.id },
      data,
    });
  }

  async remove(ctx: AuthContext, id: string) {
    const review = await this.findOne(ctx, id);
    if (!review) throw new NotFoundException('Отзыв не найден');
    return this.prisma.review.delete({
      where: { id },
    });
  }
}
