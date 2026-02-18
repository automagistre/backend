import { Field, ID, ObjectType } from '@nestjs/graphql';
import { BaseModel } from './base.model';

/**
 * Базовая модель с полем createdBy для аудита.
 * При создании записей передавайте createdBy из getRequestContext().userId или @CurrentUser().sub.
 */
@ObjectType({ description: 'Базовая модель с полем createdBy' })
export class LoggedCreatedByModel extends BaseModel {
  @Field(() => ID, { nullable: true, description: 'Кем создан' })
  createdBy: string | null;
}
