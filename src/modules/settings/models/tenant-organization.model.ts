import { Field, ObjectType } from '@nestjs/graphql';
import { OrganizationModel } from 'src/modules/organization/models/organization.model';

@ObjectType({ description: 'Юр. лицо, привязанное к сервису' })
export class TenantOrganizationModel {
  @Field(() => OrganizationModel)
  organization: OrganizationModel;

  @Field(() => Boolean, { description: 'Печатается по умолчанию' })
  isDefault: boolean;
}
