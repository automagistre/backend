import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class CreateManufacturerInput {
  @Field({ nullable: false, description: 'Название производителя' })
  name: string;

  @Field({ nullable: true, description: 'Название производителя на русском' })
  localizedName?: string;

  @Field({ nullable: true, description: 'Логотип производителя' })
  logo?: string;
}
