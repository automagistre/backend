import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('SiteVehicleManufacturer')
export class WwwVehicleManufacturer {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  name: string;

  @Field(() => String, { nullable: true })
  localizedName: string | null;
}

@ObjectType('SiteVehicleProduction')
export class WwwVehicleProduction {
  @Field(() => Int, { nullable: true })
  from: number | null;

  @Field(() => Int, { nullable: true })
  till: number | null;
}

@ObjectType('SiteVehicle')
export class WwwVehicle {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  name: string;

  @Field(() => String, { nullable: true })
  caseName: string | null;

  @Field(() => String, { nullable: true })
  localizedName: string | null;

  @Field(() => WwwVehicleManufacturer)
  manufacturer: WwwVehicleManufacturer;

  @Field(() => WwwVehicleProduction)
  production: WwwVehicleProduction;
}
