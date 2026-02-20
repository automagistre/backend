import { ObjectType, Field } from '@nestjs/graphql';
import { MeTenantModel } from './me-tenant.model';

@ObjectType()
export class MeModel {
  @Field(() => [MeTenantModel], { description: 'Доступные организации' })
  tenants: MeTenantModel[];
}
