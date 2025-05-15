import { Field, ID, ObjectType } from '@nestjs/graphql';
import { BaseModel } from './base.mode';

@ObjectType({ description: 'Модель производителя' })
export class LoggedCreatedByModel extends BaseModel {
  @Field(() => ID, { nullable: true, description: 'Кем создан' })
  createdBy: string | null;
}
