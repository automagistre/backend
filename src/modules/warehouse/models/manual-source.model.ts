import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Источник движения: ручная корректировка' })
export class ManualSourceModel {
  @Field(() => String, { nullable: true, description: 'Описание корректировки' })
  description?: string | null;
}
