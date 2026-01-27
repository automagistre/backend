import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Car } from '@prisma/client';
import { VehicleModel } from './vahicle.model';
import { CarEngineType } from '../enums/car-engine-type.enum';
import { CarEngineAirIntake } from '../enums/car-engine-airIntake.enum';
import { CarTransmission } from '../enums/car-transmission.enum';
import { CarWheelDrive } from '../enums/car-wheel-drive.enum';
import { CarEngineInjection } from '../enums/car-engine-injection.enum';
import { BodyType } from '../enums/case-type.enum';
import { VINScalar } from 'src/common/scalars/vin.scalar';
import { GosNomerRUScalar } from 'src/common/scalars/gosnomer-ru.scalar';

export {
  CarTransmission,
  CarWheelDrive,
  CarEngineType,
  CarEngineAirIntake,
  CarEngineInjection,
};

@ObjectType({ description: 'Идентификатор автомобиля' })
export class VehicleIdentifier {
  @Field(() => VINScalar, { nullable: true, description: 'VIN автомобиля' })
  vin?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Номер кузова автомобиля',
  })
  frame?: string | null;
}

@ObjectType({ description: 'Номер автомобиля' })
export class CarNumber {
  @Field(() => GosNomerRUScalar, {
    nullable: true,
    description: 'Гос. номер автомобиля (RU)',
  })
  gosnomerRu?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Гос. номер автомобиля (другой страны)',
  })
  gosnomerOther?: string | null;
}

@ObjectType({ description: 'Автомобиль' })
export class CarModel implements Omit<Car, 'identifier' | 'gosnomer'> {
  // Основная информация
  @Field(() => ID, { description: 'ID автомобиля' })
  id: string;

  @Field(() => String, {
    nullable: true,
    description: 'Информация о автомобиле',
  })
  description: string | null;

  @Field(() => String, { nullable: true, description: 'ID группы клиента' })
  tenantGroupId: string;

  // Идентификаторы
  vehicleId: string | null;

  @Field(() => VehicleIdentifier, {
    nullable: true,
    description: 'VIN автомобиля или номер кузова',
  })
  identifier: VehicleIdentifier | null;

  // Характеристики автомобиля
  @Field(() => Int, { nullable: true, description: 'Год выпуска автомобиля' })
  year: number | null;

  @Field(() => BodyType, {
    nullable: true,
    description: 'Тип кузова автомобиля',
  })
  caseType: number;

  @Field(() => Int, { nullable: true, description: 'Пробег автомобиля' })
  mileage: number;

  // Номера

  @Field(() => CarNumber, {
    nullable: true,
    description: 'Гос. номер автомобиля',
  })
  gosnomer: CarNumber | null;

  // Оборудование
  @Field(() => CarTransmission, {
    nullable: true,
    description: 'Тип трансмиссии автомобиля',
  })
  equipmentTransmission: number;

  @Field(() => CarWheelDrive, {
    nullable: true,
    description: 'Тип привода автомобиля',
  })
  equipmentWheelDrive: number;

  @Field(() => String, {
    nullable: true,
    description: 'Название двигателя автомобиля',
  })
  equipmentEngineName: string | null;

  @Field(() => CarEngineType, {
    nullable: true,
    description: 'Тип двигателя автомобиля',
  })
  equipmentEngineType: number;

  @Field(() => CarEngineAirIntake, {
    nullable: true,
    description: 'Тип воздухозабора двигателя автомобиля',
  })
  equipmentEngineAirIntake: number;

  @Field(() => CarEngineInjection, {
    nullable: true,
    description: 'Тип впрыска двигателя автомобиля',
  })
  equipmentEngineInjection: number;

  @Field(() => String, {
    nullable: true,
    description: 'Объем двигателя автомобиля',
  })
  equipmentEngineCapacity: string;

  // Связи
  @Field(() => VehicleModel, { description: 'Модель автомобиля' })
  vehicle: VehicleModel;

  // Метаданные
  @Field(() => Date, { nullable: true, description: 'Дата создания записи' })
  createdAt: Date;

  createdBy: string | null;
}
