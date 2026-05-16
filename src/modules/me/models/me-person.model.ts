import { Field, ID, ObjectType } from '@nestjs/graphql';

/**
 * Профиль текущего пользователя — минимальный набор полей для клиентского endpoint.
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
