import { registerEnumType } from '@nestjs/graphql';

export enum OrderDirection {
  ASC = 'asc',
  DESC = 'desc',
}

// Регистрируем enum в GraphQL
registerEnumType(OrderDirection, {
  name: 'OrderDirection', // Название типа в GraphQL
  description:
    'Направление сортировки: ASC (по возрастанию) или DESC (по убыванию)',
});
