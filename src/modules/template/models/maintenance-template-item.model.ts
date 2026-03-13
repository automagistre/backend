import { Field, Int, ObjectType } from '@nestjs/graphql';
import { TemplatePartModel } from './template-part.model';
import { TemplateWorkModel } from './template-work.model';

@ObjectType({ description: 'Элемент шаблона ТО: работа, ее запчасти и период' })
export class MaintenanceTemplateItemModel {
  @Field(() => Int, { description: 'Период ТО в км (10000, 20000, ...)' })
  period: number;

  @Field(() => Boolean, { description: 'Рекомендуемая работа' })
  recommended: boolean;

  @Field(() => TemplateWorkModel)
  work: TemplateWorkModel;

  @Field(() => [TemplatePartModel])
  parts: TemplatePartModel[];
}
