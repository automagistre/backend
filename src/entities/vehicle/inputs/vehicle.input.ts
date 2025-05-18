import { Field, ID, InputType, Int, PartialType } from '@nestjs/graphql';
import { Max, Min } from 'class-validator';

@InputType({ description: 'Создать модель автомобиля' })
export class CreateVehicleInput {
  @Field(() => String, { description: 'Название модели' })
  name: string;

  @Field(() => String, { description: 'ID производителя' })
  manufacturerId: string;

  @Field(() => String, {
    nullable: true,
    description: 'Локализованное название модели',
  })
  localizedName: string | null;

  @Field(() => String, { nullable: true, description: 'Код кузова' })
  caseName: string | null;

  @Min(1970)
  @Max(new Date().getFullYear())
  @Field(() => Int, { nullable: true, description: 'Год начала производства' })
  yearFrom: number | null;

  @Min(1970)
  @Max(new Date().getFullYear())
  @Field(() => Int, {
    nullable: true,
    description: 'Год окончания производства',
  })
  yearTill: number | null;
}

@InputType({ description: 'Обновить модель автомобиля' })
export class UpdateVehicleInput extends PartialType(CreateVehicleInput) {
  @Field(() => ID, { description: 'ID модели' })
  id: string;
}
