import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Подсказка названия работы' })
export class ServiceSuggestionModel {
  @Field(() => String)
  name: string;

  @Field(() => Boolean, {
    description:
      'Работа из канонического whitelist подрядных работ',
  })
  isContractor: boolean;
}
