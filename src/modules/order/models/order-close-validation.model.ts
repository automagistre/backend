import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Валидация закрытия заказа' })
export class OrderCloseValidationModel {
  @Field(() => Boolean, {
    description: 'Можно закрыть заказ (нет недостатков)',
  })
  canClose: boolean;

  @Field(() => [String], {
    description:
      'Недостатки для закрытия (MILEAGE_MISSING, SERVICES_WITHOUT_WORKER)',
  })
  closeDeficiencies: string[];
}
