import { Field, ID, ObjectType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { AuditAction, AuditEntityType } from '../enums/audit.enums';
import { AuditChangeModel } from './audit-change.model';

@ObjectType({ description: 'Событие журнала аудита' })
export class AuditLogEventModel {
  @Field(() => ID)
  id: string;

  @Field(() => AuditEntityType, { description: 'Тип агрегата (root)' })
  rootEntityType: AuditEntityType;

  @Field(() => ID, { description: 'ID агрегата (root)' })
  rootEntityId: string;

  @Field(() => String, {
    nullable: true,
    description: 'Подпись агрегата, напр. «Заказ №123»',
  })
  rootDisplayName: string | null;

  @Field(() => AuditEntityType, { description: 'Тип изменённой сущности' })
  entityType: AuditEntityType;

  @Field(() => ID, { description: 'ID изменённой сущности' })
  entityId: string;

  @Field(() => AuditAction)
  action: AuditAction;

  @Field(() => ID, { nullable: true, description: 'Автор (null = система)' })
  actorId: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Подпись сущности на момент события',
  })
  entityDisplayName: string | null;

  @Field(() => [AuditChangeModel], { description: 'Изменённые поля' })
  changes: AuditChangeModel[];

  @Field(() => GraphQLJSON, { nullable: true, description: 'Доп. контекст' })
  metadata: Record<string, unknown> | null;

  @Field(() => Date)
  createdAt: Date;
}
