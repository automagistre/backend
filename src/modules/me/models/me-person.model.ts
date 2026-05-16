import { Field, ID, ObjectType } from '@nestjs/graphql';
import type { Person } from 'src/generated/prisma/client';

/**
 * Профиль клиента — минимальный набор полей для клиентского endpoint.
 * Не путать с админским PersonModel: здесь только то, что клиент видит про себя.
 */
@ObjectType('MePerson')
export class MePerson {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  firstname!: string | null;

  @Field(() => String, { nullable: true })
  lastname!: string | null;

  @Field(() => String, { nullable: true })
  telephone!: string | null;

  @Field(() => String, { nullable: true })
  officePhone!: string | null;

  @Field(() => String, { nullable: true })
  email!: string | null;
}

export function toMePerson(person: Person): MePerson {
  return {
    id: person.id,
    firstname: person.firstname ?? null,
    lastname: person.lastname ?? null,
    telephone: person.telephone ?? null,
    officePhone: person.officePhone ?? null,
    email: person.email ?? null,
  };
}
