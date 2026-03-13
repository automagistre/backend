import { Field, ObjectType } from '@nestjs/graphql';
import { MaintenanceTemplateModel } from './maintenance-template.model';

@ObjectType({ description: 'Подходящие для автомобиля шаблоны по типам' })
export class TemplatesModel {
  @Field(() => [MaintenanceTemplateModel], {
    description: 'Шаблоны ТО для автомобиля',
  })
  maintenance: MaintenanceTemplateModel[];
}
