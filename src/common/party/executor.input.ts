import { Field, ID, InputType } from '@nestjs/graphql';
import { PartyKind } from './party.types';

/**
 * Вход для исполнителя работ/рекомендаций: явный тип субъекта + id.
 * Заменяет неявный workerId (bare UUID).
 */
@InputType()
export class ExecutorInput {
  @Field(() => PartyKind)
  kind: PartyKind;

  @Field(() => ID)
  id: string;
}

/** Маппинг исполнителя из GraphQL-инпута в колонки БД (executor_kind / executor_id). */
export function executorToDb(executor?: ExecutorInput | null): {
  executorKind: PartyKind | null;
  executorId: string | null;
} {
  return {
    executorKind: executor?.kind ?? null,
    executorId: executor?.id ?? null,
  };
}
