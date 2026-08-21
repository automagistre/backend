import { Field, ObjectType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import {
  StaffPositionSettingGroup,
  StaffPositionSettingKey,
  StaffPositionSettingType,
} from '../enums/staff-position-setting.enum';

@ObjectType({ description: 'Значение настройки должности' })
export class StaffPositionSettingValueModel {
  @Field(() => StaffPositionSettingKey)
  key: StaffPositionSettingKey;

  @Field(() => GraphQLJSON, {
    description: 'Типизированное значение: булево, токен цвета, число',
  })
  value: unknown;
}

@ObjectType({ description: 'Вариант значения настройки типа ENUM' })
export class StaffPositionSettingOptionModel {
  @Field(() => String)
  value: string;

  @Field(() => String)
  label: string;

  @Field(() => String, {
    nullable: true,
    description: 'Токен палитры для образца цвета рядом с вариантом',
  })
  color?: string | null;
}

@ObjectType({ description: 'Описание настройки должности из каталога' })
export class StaffPositionSettingDefinitionModel {
  @Field(() => StaffPositionSettingKey)
  key: StaffPositionSettingKey;

  @Field(() => StaffPositionSettingType)
  type: StaffPositionSettingType;

  @Field(() => String)
  label: string;

  @Field(() => String, { description: 'Подсказка под иконкой info' })
  hint: string;

  @Field(() => Boolean, {
    description:
      'Мастер группы: пока выключен, остальные настройки группы не действуют',
  })
  isMaster: boolean;

  @Field(() => [StaffPositionSettingOptionModel], {
    nullable: true,
    description: 'Варианты для типа ENUM',
  })
  options?: StaffPositionSettingOptionModel[];
}

@ObjectType({ description: 'Группа настроек должности' })
export class StaffPositionSettingGroupModel {
  @Field(() => StaffPositionSettingGroup)
  key: StaffPositionSettingGroup;

  @Field(() => String)
  label: string;

  @Field(() => String, { description: 'Подсказка под иконкой info' })
  hint: string;

  @Field(() => [StaffPositionSettingDefinitionModel], {
    description: 'Настройки группы, мастер идёт первым',
  })
  settings: StaffPositionSettingDefinitionModel[];
}
