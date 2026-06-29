import { registerEnumType } from '@nestjs/graphql';

/**
 * Вид субъекта-операнда: персона или организация.
 * Используется как дискриминатор для исполнителя (Executor) и любых ссылок person|org.
 */
export enum PartyKind {
  PERSON = 'PERSON',
  ORGANIZATION = 'ORGANIZATION',
}

registerEnumType(PartyKind, {
  name: 'PartyKind',
  description: 'Вид субъекта: персона или организация',
});

export interface PartyDbValue {
  kind: PartyKind;
  id: string;
}
