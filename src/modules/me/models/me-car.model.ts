import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import type { Car, Manufacturer, Vehicle } from 'src/generated/prisma/client';

/**
 * Автомобиль клиента — минимальный набор полей для LK.
 * Не путать с админским CarModel: здесь только то, что клиент видит про свою машину.
 */
@ObjectType('MeCar')
export class MeCar {
  @Field(() => ID)
  id!: string;

  /** Производитель + модель + кузов в одну строку для UI */
  @Field(() => String, {
    description: 'Производитель и модель (например, "BMW X5 E70")',
  })
  vehicleName!: string;

  @Field(() => String, { nullable: true, description: 'VIN или номер кузова' })
  identifier!: string | null;

  @Field(() => String, { nullable: true, description: 'Гос. номер' })
  gosnomer!: string | null;

  @Field(() => Int, { nullable: true, description: 'Год выпуска' })
  year!: number | null;

  @Field(() => Int, { description: 'Пробег, км' })
  mileage!: number;
}

type CarWithVehicle = Car & {
  vehicle: (Vehicle & { manufacturer: Manufacturer }) | null;
};

export function toMeCar(car: CarWithVehicle): MeCar {
  const manufacturer = car.vehicle?.manufacturer?.name ?? '';
  const model = car.vehicle?.name ?? '';
  const caseName = car.vehicle?.caseName ?? '';
  const vehicleName =
    [manufacturer, model, caseName].filter(Boolean).join(' ').trim() ||
    'Автомобиль';

  return {
    id: car.id,
    vehicleName,
    identifier: car.identifier ?? null,
    gosnomer: car.gosnomer ?? null,
    year: car.year ?? null,
    mileage: car.mileage,
  };
}
