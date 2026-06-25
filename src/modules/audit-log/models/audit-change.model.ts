import { Field, ObjectType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { AuditChangeKind } from '../enums/audit.enums';

@ObjectType({ description: 'Изменение одного поля в событии аудита' })
export class AuditChangeModel {
  @Field(() => String, { description: 'Техническое имя поля' })
  field: string;

  @Field(() => String, { description: 'Человекочитаемое название поля' })
  label: string;

  @Field(() => AuditChangeKind, { description: 'Вид значения для форматирования' })
  kind: AuditChangeKind;

  @Field(() => GraphQLJSON, { nullable: true, description: 'Значение до' })
  oldValue: unknown;

  @Field(() => GraphQLJSON, { nullable: true, description: 'Значение после' })
  newValue: unknown;
}
