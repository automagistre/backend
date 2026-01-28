import { Field, ID, ObjectType } from '@nestjs/graphql';
import { EmployeeModel } from 'src/modules/employee/models/employee.model';
import { CarModel } from 'src/modules/vehicle/models/car.model';
import { CarRecommendationPartModel } from './car-recommendation-part.model';

@ObjectType({ description: 'Рекомендация по автомобилю (результат диагностики)' })
export class CarRecommendationModel {
  @Field(() => ID)
  id: string;

  @Field(() => ID, { nullable: true })
  carId: string | null;

  @Field(() => CarModel, { nullable: true })
  car?: CarModel | null;

  @Field(() => String)
  service: string;

  @Field(() => ID)
  workerId: string;

  @Field(() => EmployeeModel, { nullable: true })
  worker?: EmployeeModel | null;

  @Field(() => Date, { nullable: true })
  expiredAt: Date | null;

  @Field(() => ID, { nullable: true })
  realization: string | null;

  @Field(() => BigInt, { nullable: true })
  priceAmount: bigint | null;

  @Field(() => String, { nullable: true })
  priceCurrencyCode: string | null;

  @Field(() => [CarRecommendationPartModel])
  parts: CarRecommendationPartModel[];

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  @Field(() => ID, { nullable: true })
  createdBy: string | null;
}

