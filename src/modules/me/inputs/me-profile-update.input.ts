import { Field, InputType } from '@nestjs/graphql';

/**
 * Partial update профиля клиента.
 * Все поля опциональны — обновляются только переданные.
 *
 * Не входит в input основной телефон (telephone) — меняется только через
 * автосервис, потому что используется как identity-ключ.
 */
@InputType('MeProfileUpdateInput')
export class MeProfileUpdateInput {
  @Field(() => String, { nullable: true })
  firstname?: string | null;

  @Field(() => String, { nullable: true })
  lastname?: string | null;

  @Field(() => String, { nullable: true })
  email?: string | null;

  @Field(() => String, { nullable: true })
  officePhone?: string | null;
}
