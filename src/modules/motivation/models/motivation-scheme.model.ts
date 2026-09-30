import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsInt, IsString, Min, ValidateNested } from 'class-validator';
import {
  MotivationItemTypeEnum,
  MotivationStageEnum,
} from './motivation.enums';

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
  @Field(() => String, {
    description: 'Ключ профиля «ТИП:роль»: SERVICE:team, PART:parts, …',
  })
  key: string;

  @ValidateNested({ each: true })
  @Type(() => MotivationProfileWeightModel)
  @Field(() => [MotivationProfileWeightModel])
  weights: MotivationProfileWeightModel[];
}

@ObjectType('MotivationStageRate')
@InputType('MotivationStageRateInput')
export class MotivationStageRateModel {
  @Field(() => MotivationStageEnum)
  stage: MotivationStageEnum;

  @IsInt()
  @Min(0)
  @Field(() => Int, {
    description: 'Доля прибыли позиции за этап, базисные пункты; 0 — не платим',
  })
  rateBp: number;
}

@ObjectType('MotivationTypeScheme')
@InputType('MotivationTypeSchemeInput')
export class MotivationTypeSchemeModel {
  @Field(() => MotivationItemTypeEnum)
  type: MotivationItemTypeEnum;

  @ValidateNested({ each: true })
  @Type(() => MotivationStageRateModel)
  @Field(() => [MotivationStageRateModel], {
    description: 'Этапы типа в порядке показа; фонд позиции — сумма их долей',
  })
  stages: MotivationStageRateModel[];
}

@ObjectType('MotivationScheme', {
  description: 'Параметры распределения бонуса с продаж',
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
