import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Подсказка названия работы' })
export class ServiceSuggestionModel {
  @Field(() => String)
  name: string;

  @Field(() => Boolean, {
    description:
      'Работа встречается в подрядных рекомендациях тенанта (очищенный whitelist)',
  })
  isContractor: boolean;
}
