import { Field, ObjectType } from '@nestjs/graphql';
import { Manufacturer } from '@prisma/client';
import { LoggedCreatedByModel } from 'src/common/models/created-by.model';

@ObjectType({ description: 'Модель производителя' })
export class ManufacturerModel
  extends LoggedCreatedByModel
  implements Manufacturer
{
  @Field({ nullable: false, description: 'Название производителя' })
  name: string;

  @Field(() => String, {
    nullable: true,
    description: 'Название производителя на русском',
  })
  localizedName: string | null;

  @Field(() => String, { nullable: true, description: 'Логотип производителя' })
  logo: string | null;
}
