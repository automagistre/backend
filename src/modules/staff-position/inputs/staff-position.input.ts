import { Field, ID, InputType, Int } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { IsInt, IsOptional, Min } from 'class-validator';
import { StaffPositionSettingKey } from '../enums/staff-position-setting.enum';

@InputType({ description: 'Значение настройки должности' })
export class StaffPositionSettingInput {
  @Field(() => StaffPositionSettingKey)
  key: StaffPositionSettingKey;

  @Field(() => GraphQLJSON, {
    description: 'Значение по типу настройки из каталога',
  })
  value: unknown;
}

/**
 * Создание просит только имя: настройки задаются потом в отдельной панели,
 * иначе диалог растёт вместе с каталогом.
 */
@InputType()
export class CreateStaffPositionInput {
  @Field(() => String, { description: 'Название' })
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Field(() => Int, {
    nullable: true,
    defaultValue: 0,
    description: 'Порядок в справочнике и в графике',
  })
  sortOrder?: number;
}

@InputType()
export class UpdateStaffPositionInput {
  @Field(() => ID, { description: 'ID должности' })
  id: string;

  @IsOptional()
  @Field(() => String, { nullable: true, description: 'Название' })
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Field(() => Int, {
    nullable: true,
    description: 'Порядок в справочнике и в графике',
  })
  sortOrder?: number;

  /**
   * Полный набор настроек: чего нет в списке — снимается. Не передавать — не менять.
   */
  @IsOptional()
  @Field(() => [StaffPositionSettingInput], {
    nullable: true,
    description: 'Настройки из каталога (полный набор)',
  })
  settings?: StaffPositionSettingInput[];
}
