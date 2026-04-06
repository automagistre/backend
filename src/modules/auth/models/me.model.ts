import { ObjectType, Field } from '@nestjs/graphql';
import { MeTenantModel } from './me-tenant.model';
import { AppUserModel } from 'src/modules/app-user/models/app-user.model';

@ObjectType()
export class MeModel {
  @Field(() => AppUserModel, {
    nullable: true,
    description: 'Профиль пользователя',
  })
  profile?: AppUserModel | null;

  @Field(() => [MeTenantModel], { description: 'Доступные организации' })
  tenants: MeTenantModel[];
}
