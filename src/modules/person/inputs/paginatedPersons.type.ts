import { Field, Int, ObjectType } from '@nestjs/graphql';
import { PersonModel } from '../models/person.model';

@ObjectType()
export class PaginatedPersons {
  @Field(() => [PersonModel])
  items: PersonModel[];

  @Field(() => Int)
  total: number;
}

