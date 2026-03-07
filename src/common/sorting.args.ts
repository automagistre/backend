import { ArgsType, Field, registerEnumType } from '@nestjs/graphql';

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

registerEnumType(SortDirection, {
  name: 'SortDirection',
  description: 'Направление сортировки',
});

@ArgsType()
export class SortingArgs<T = string> {
  @Field(() => String, {
    description: 'Поле для сортировки',
  })
  field: T;

  @Field(() => SortDirection, {
    defaultValue: SortDirection.DESC,
    description: 'Направление сортировки',
  })
  direction: SortDirection;
}
