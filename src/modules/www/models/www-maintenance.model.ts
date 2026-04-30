import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { WwwMoney } from './www-money.model';

@ObjectType('SiteMaintenanceEngine')
export class WwwMaintenanceEngine {
  @Field(() => String, { nullable: true })
  name: string | null;

  @Field(() => String, { nullable: true })
  type: string | null;

  @Field(() => String, { nullable: true })
  airIntake: string | null;

  @Field(() => String, { nullable: true })
  injection: string | null;

  @Field(() => String, { nullable: true })
  capacity: string | null;
}

@ObjectType('SitePartManufacturerLite')
export class WwwPartManufacturerLite {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  name: string;

  @Field(() => String, { nullable: true })
  localizedName: string | null;
}

@ObjectType('SiteMaintenancePart')
export class WwwMaintenancePart {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  name: string;

  @Field(() => String, { nullable: true })
  number: string | null;

  @Field(() => String, { nullable: true })
  unit: string | null;

  @Field(() => WwwMoney)
  price: WwwMoney;

  @Field(() => WwwPartManufacturerLite)
  manufacturer: WwwPartManufacturerLite;
}

@ObjectType('SiteMaintenanceWorkPart')
export class WwwMaintenanceWorkPart {
  @Field(() => WwwMaintenancePart)
  part: WwwMaintenancePart;

  @Field(() => Int, { description: 'Количество (×100 в БД, отдаём как есть)' })
  quantity: number;
}

@ObjectType('SiteMaintenanceWork')
export class WwwMaintenanceWork {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  name: string;

  @Field(() => String, { nullable: true })
  description: string | null;

  @Field(() => Int, { description: 'Период ТО в км' })
  period: number;

  @Field(() => Int, { description: 'Позиция в карте ТО' })
  position: number;

  @Field(() => Boolean, { description: 'Рекомендуемая работа' })
  recommended: boolean;

  @Field(() => WwwMoney)
  price: WwwMoney;

  @Field(() => [WwwMaintenanceWorkPart])
  parts: WwwMaintenanceWorkPart[];
}

@ObjectType('SiteMaintenance')
export class WwwMaintenance {
  @Field(() => ID)
  id: string;

  @Field(() => WwwMaintenanceEngine)
  engine: WwwMaintenanceEngine;

  @Field(() => String, { nullable: true })
  transmission: string | null;

  @Field(() => String, { nullable: true })
  wheelDrive: string | null;

  @Field(() => [WwwMaintenanceWork])
  works: WwwMaintenanceWork[];
}
