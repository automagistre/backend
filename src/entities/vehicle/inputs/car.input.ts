import {
  InputType,
  Field,
  ID,
  Int,
  PartialType,
  OmitType,
} from '@nestjs/graphql';
import { BodyType } from '../enums/case-type.enum';
import { CarTransmission } from '../enums/car-transmission.enum';
import { CarWheelDrive } from '../enums/car-wheel-drive.enum';
import { CarEngineType } from '../enums/car-engine-type.enum';
import { CarEngineAirIntake } from '../enums/car-engine-airIntake.enum';
import { CarEngineInjection } from '../enums/car-engine-injection.enum';
import { VINScalar } from 'src/common/scalars/vin.scalar';
import { GosNomerRUScalar } from 'src/common/scalars/gosnomer-ru.scalar';
import { IsInt, Length, Max, Min } from 'class-validator';

@InputType()
export class CreateCarInput {
  // Основная информация
  @Field(() => String, {
    nullable: true,
    description: 'Информация о автомобиле',
  })
  description?: string | null;

  // Идентификаторы
  @Field(() => VINScalar, { nullable: true, description: 'VIN автомобиля' })
  vin?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Номер кузова автомобиля',
  })
  frame?: string | null;

  // Характеристики автомобиля
  @Min(1950)
  @Max(new Date().getFullYear())
  @Field(() => Int, { nullable: true, description: 'Год выпуска автомобиля' })
  year?: number | null;

  @Field(() => BodyType, {
    nullable: true,
    description: 'Тип кузова автомобиля',
  })
  caseType: number;

  @Min(0)
  @IsInt()
  @Field(() => Int, { nullable: true, description: 'Пробег автомобиля' })
  mileage: number;

  // Номера
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

  // Оборудование
  @Field(() => CarTransmission, {
    nullable: true,
    description: 'Тип трансмиссии автомобиля',
  })
  equipmentTransmission?: CarTransmission;

  @Field(() => CarWheelDrive, {
    nullable: true,
    description: 'Тип привода автомобиля',
  })
  equipmentWheelDrive?: CarWheelDrive;

  @Length(2, 10)
  @Field(() => String, {
    nullable: true,
    description: 'Название двигателя автомобиля',
  })
  equipmentEngineName?: string | null;

  @Field(() => CarEngineType, {
    nullable: true,
    description: 'Тип двигателя автомобиля',
  })
  equipmentEngineType?: CarEngineType;

  @Field(() => CarEngineAirIntake, {
    nullable: true,
    description: 'Тип воздухозабора двигателя автомобиля',
  })
  equipmentEngineAirIntake?: CarEngineAirIntake;

  @Field(() => CarEngineInjection, {
    nullable: true,
    description: 'Тип впрыска двигателя автомобиля',
  })
  equipmentEngineInjection?: CarEngineInjection;

  @Field(() => String, {
    nullable: true,
    description: 'Объем двигателя автомобиля',
  })
  equipmentEngineCapacity?: string;
}

@InputType()
export class UpdateCarInput extends PartialType(CreateCarInput) {
  @Field(() => ID, { description: 'ID автомобиля' })
  id: string;
}

export class CreateCarInputPrisma extends OmitType(CreateCarInput, [
  'vin',
  'gosnomerRu',
  'gosnomerOther',
  'frame',
] as const) {
  identifier?: string;

  gosnomer?: string;
}

export class UpdateCarInputPrisma extends OmitType(UpdateCarInput, [
  'vin',
  'gosnomerRu',
  'gosnomerOther',
  'frame',
] as const) {
  identifier?: string;

  gosnomer?: string;
}
