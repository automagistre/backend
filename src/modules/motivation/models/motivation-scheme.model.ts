import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsString, Min, ValidateNested } from 'class-validator';
import {
  MotivationItemTypeEnum,
  MotivationPolicyEnum,
  MotivationStageEnum,
} from './motivation.enums';

/** Источники участников; в GraphQL строкой — двоеточие в enum недопустимо. */
export const MOTIVATION_SOURCES = [
  'SNAPSHOT:ITEM',
  'SNAPSHOT:RECOMMENDATION',
  'SNAPSHOT:CONTRACT',
  'ACTOR:PICKER',
  'SCHEDULE:ITEM',
  'SCHEDULE:RECOMMENDATION',
  'SCHEDULE:CONTRACT',
] as const;

@ObjectType('MotivationProfileWeight')
@InputType('MotivationProfileWeightInput')
export class MotivationProfileWeightModel {
  @IsString()
  @Field(() => ID)
  positionId: string;

  @IsInt()
  @Min(0)
  @Field(() => Int, { description: 'Вес должности; 0 — не участвует' })
  weight: number;
}

@ObjectType('MotivationProfile')
@InputType('MotivationProfileInput')
export class MotivationProfileModel {
  @IsString()
  @Field(() => String, { description: 'Ключ профиля: team, parts' })
  key: string;

  @ValidateNested({ each: true })
  @Type(() => MotivationProfileWeightModel)
  @Field(() => [MotivationProfileWeightModel])
  weights: MotivationProfileWeightModel[];
}

@ObjectType('MotivationChainStep')
@InputType('MotivationChainStepInput')
export class MotivationChainStepModel {
  @IsIn(MOTIVATION_SOURCES)
  @Field(() => String, {
    description: 'Источник участников: SNAPSHOT:ITEM, ACTOR:PICKER, …',
  })
  source: string;

  @IsString()
  @Field(() => String, { description: 'Ключ профиля весов' })
  profile: string;
}

@ObjectType('MotivationStageScheme')
@InputType('MotivationStageSchemeInput')
export class MotivationStageSchemeModel {
  @Field(() => MotivationStageEnum)
  stage: MotivationStageEnum;

  @IsInt()
  @Min(1)
  @Field(() => Int, { description: 'Доля фонда позиции, базисные пункты' })
  shareBp: number;

  @Field(() => MotivationPolicyEnum)
  policy: MotivationPolicyEnum;

  @Field(() => [MotivationStageEnum], {
    nullable: true,
    description: 'Кому уходит доля при REDISTRIBUTE',
  })
  redistributeTo?: MotivationStageEnum[] | null;

  @ValidateNested({ each: true })
  @Type(() => MotivationChainStepModel)
  @Field(() => [MotivationChainStepModel])
  chain: MotivationChainStepModel[];
}

@ObjectType('MotivationTypeScheme')
@InputType('MotivationTypeSchemeInput')
export class MotivationTypeSchemeModel {
  @Field(() => MotivationItemTypeEnum)
  type: MotivationItemTypeEnum;

  @IsInt()
  @Min(0)
  @Field(() => Int, {
    description: 'Ставка фонда от прибыли позиции, базисные пункты',
  })
  rateBp: number;

  @ValidateNested({ each: true })
  @Type(() => MotivationStageSchemeModel)
  @Field(() => [MotivationStageSchemeModel])
  stages: MotivationStageSchemeModel[];
}

@ObjectType('MotivationScheme', {
  description: 'Параметры распределения премии',
})
@InputType('MotivationSchemeInput')
export class MotivationSchemeModel {
  @ValidateNested({ each: true })
  @Type(() => MotivationProfileModel)
  @Field(() => [MotivationProfileModel])
  profiles: MotivationProfileModel[];

  @ValidateNested({ each: true })
  @Type(() => MotivationTypeSchemeModel)
  @Field(() => [MotivationTypeSchemeModel])
  types: MotivationTypeSchemeModel[];
}
