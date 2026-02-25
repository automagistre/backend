import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Источник движения: инвентаризация' })
export class InventorizationSourceModel {
  @Field(() => String, {
    nullable: true,
    description: 'Описание инвентаризации',
  })
  description?: string | null;
}
