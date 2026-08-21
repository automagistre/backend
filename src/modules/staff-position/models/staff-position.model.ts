import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { StaffPosition } from 'src/generated/prisma/client';
import { StaffPositionSettingValueModel } from './staff-position-setting.model';

@ObjectType({ description: 'Должность сотрудника' })
export class StaffPositionModel implements StaffPosition {
  @Field(() => ID)
  id: string;

  @Field(() => String, { description: 'Название' })
  name: string;

  @Field(() => Int, { description: 'Порядок в справочнике и в графике' })
  sortOrder: number;

  @Field(() => Date, {
    nullable: true,
    description: 'Дата архивации. null — должность активна',
  })
  archivedAt: Date | null;

  @Field(() => String)
  tenantId: string;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  createdBy: string | null;

  @Field(() => [StaffPositionSettingValueModel], {
    description: 'Заданные настройки из каталога',
  })
  settings: StaffPositionSettingValueModel[];
}
