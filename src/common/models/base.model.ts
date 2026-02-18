import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Базовая модель' })
export class BaseModel {
  @Field(() => ID)
  id: string;

  @Field(() => Date, { description: 'Дата создания' })
  createdAt: Date;

  @Field(() => Date, { description: 'Дата обновления' })
  updatedAt: Date;
}
