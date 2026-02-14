import { Field, Int, InputType } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

@InputType()
export class CreateReviewInput {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Field(() => String, { description: 'Автор' })
  author: string;

  @IsString()
  @MinLength(1)
  @Field(() => String, { description: 'Текст отзыва' })
  text: string;

  @IsInt()
  @Min(1)
  @Max(5)
  @Field(() => Int, { description: 'Оценка (1–5)' })
  rating: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  @Field(() => Int, { nullable: true, description: 'Источник (0–5), по умолчанию 2 — внутренний' })
  source?: number;

  @IsOptional()
  @Field(() => Date, { nullable: true, description: 'Дата публикации, по умолчанию — сейчас' })
  publishAt?: Date;
}
