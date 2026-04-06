import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Профиль пользователя (Keycloak)' })
export class AppUserModel {
  @Field(() => ID)
  id: string;

  @Field({ description: 'Отображаемое имя (fallback из Keycloak)' })
  displayName: string;

  @Field(() => ID, { nullable: true })
  personId: string | null;
}
