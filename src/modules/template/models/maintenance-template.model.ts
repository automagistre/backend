import { Field, ID, ObjectType } from '@nestjs/graphql';
import { MaintenanceTemplateItemModel } from './maintenance-template-item.model';

@ObjectType({ description: 'Шаблон ТО (подходящая комплектация)' })
export class MaintenanceTemplateModel {
  @Field(() => ID, { description: 'ID комплектации McEquipment' })
  id: string;

  @Field(() => String, { description: 'Подпись комплектации' })
  label: string;

  @Field(() => [MaintenanceTemplateItemModel], {
    description: 'Элементы шаблона (работы с периодом и их запчастями)',
  })
  items: MaintenanceTemplateItemModel[];
}
