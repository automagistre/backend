import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Vehicle } from '@prisma/client';
import { Max, Min } from 'class-validator';
import { ManufacturerModel } from 'src/entities/manufacturer/models/manufacturer.model';

@ObjectType({ description: 'Модель автомобиля' })
export class VehicleModel implements Vehicle {
  @Field(() => ID, { description: 'ID модели' })
  id: string;

  @Field(() => String, { description: 'Название модели' })
  name: string;

  manufacturerId: string;

  @Field(() => ManufacturerModel, { description: 'Производитель' })
  manufacturer: ManufacturerModel;

  @Field(() => String, { nullable: true, description: 'Локализованное название модели' })
  localizedName: string | null;

  @Field(() => String, { nullable: true, description: 'Код кузова' })
  caseName: string | null;

  @Min(1970)
  @Max(new Date().getFullYear())
  @Field(() => Int, { nullable: true, description: 'Год начала производства' })
  yearFrom: number | null;

  @Min(1970)
  @Max(new Date().getFullYear())
  @Field(() => Int, { nullable: true, description: 'Год окончания производства' })
  yearTill: number | null;

  @Field(() => Date, { nullable: true, description: 'Дата создания' })
  createdAt: Date | null;

  @Field(() => ID, { nullable: true, description: 'ID создателя' })
  createdBy: string | null;
}
