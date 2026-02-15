import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { VehicleModel } from 'src/modules/vehicle/models/vahicle.model';
import { CarTransmission } from 'src/modules/vehicle/enums/car-transmission.enum';
import { CarWheelDrive } from 'src/modules/vehicle/enums/car-wheel-drive.enum';
import { CarEngineType } from 'src/modules/vehicle/enums/car-engine-type.enum';
import { CarEngineAirIntake } from 'src/modules/vehicle/enums/car-engine-airIntake.enum';
import { CarEngineInjection } from 'src/modules/vehicle/enums/car-engine-injection.enum';
import { McLineModel } from './mc-line.model';

@ObjectType({ description: 'Комплектация (модель авто + оборудование + период ТО)' })
export class McEquipmentModel {
  @Field(() => ID)
  id: string;

  @Field(() => VehicleModel, { description: 'Модель автомобиля' })
  vehicle: VehicleModel;

  @Field(() => Int, { description: 'Период ТО в тыс. км' })
  period: number;

  @Field(() => CarTransmission, {
    nullable: true,
    description: 'Тип трансмиссии',
  })
  equipmentTransmission: number;

  @Field(() => CarWheelDrive, {
    nullable: true,
    description: 'Тип привода',
  })
  equipmentWheelDrive: number;

  @Field(() => String, {
    nullable: true,
    description: 'Название двигателя',
  })
  equipmentEngineName: string | null;

  @Field(() => CarEngineType, {
    nullable: true,
    description: 'Тип двигателя',
  })
  equipmentEngineType: number;

  @Field(() => CarEngineAirIntake, {
    nullable: true,
    description: 'Тип воздухозабора двигателя',
  })
  equipmentEngineAirIntake: number;

  @Field(() => CarEngineInjection, {
    nullable: true,
    description: 'Тип впрыска',
  })
  equipmentEngineInjection: number;

  @Field(() => String, {
    nullable: true,
    description: 'Объём двигателя (например 2.0)',
  })
  equipmentEngineCapacity: string;

  @Field(() => String)
  tenantId: string;

  @Field(() => [McLineModel], { description: 'Строки карты ТО (работы + запчасти)' })
  lines: McLineModel[];

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;
}
