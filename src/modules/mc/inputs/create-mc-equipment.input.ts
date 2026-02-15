import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { CarTransmission } from 'src/modules/vehicle/enums/car-transmission.enum';
import { CarWheelDrive } from 'src/modules/vehicle/enums/car-wheel-drive.enum';
import { CarEngineType } from 'src/modules/vehicle/enums/car-engine-type.enum';
import { CarEngineAirIntake } from 'src/modules/vehicle/enums/car-engine-airIntake.enum';
import { CarEngineInjection } from 'src/modules/vehicle/enums/car-engine-injection.enum';

@InputType()
export class CreateMcEquipmentInput {
  @IsUUID()
  @Field(() => String, { description: 'ID модели автомобиля' })
  vehicleId: string;

  @IsInt()
  @Min(1)
  @Field(() => Int, { description: 'Период ТО в тыс. км' })
  period: number;

  @Field(() => CarTransmission, {
    nullable: true,
    description: 'Тип трансмиссии',
  })
  equipmentTransmission?: CarTransmission;

  @Field(() => CarWheelDrive, {
    nullable: true,
    description: 'Тип привода',
  })
  equipmentWheelDrive?: CarWheelDrive;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Field(() => String, {
    nullable: true,
    description: 'Название двигателя',
  })
  equipmentEngineName?: string | null;

  @Field(() => CarEngineType, {
    nullable: true,
    description: 'Тип двигателя',
  })
  equipmentEngineType?: CarEngineType;

  @Field(() => CarEngineAirIntake, {
    nullable: true,
    description: 'Тип воздухозабора двигателя',
  })
  equipmentEngineAirIntake?: CarEngineAirIntake;

  @Field(() => CarEngineInjection, {
    nullable: true,
    description: 'Тип впрыска',
  })
  equipmentEngineInjection?: CarEngineInjection;

  @IsString()
  @MaxLength(255)
  @Field(() => String, {
    description: 'Объём двигателя (например 2.0)',
  })
  equipmentEngineCapacity: string;
}
