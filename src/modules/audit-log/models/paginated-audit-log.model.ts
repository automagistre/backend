import { Field, Int, ObjectType } from '@nestjs/graphql';
import { AuditLogEventModel } from './audit-log-event.model';

@ObjectType({ description: 'Страница журнала аудита' })
export class PaginatedAuditLog {
  @Field(() => [AuditLogEventModel])
  items: AuditLogEventModel[];

  @Field(() => Int)
  total: number;
}
