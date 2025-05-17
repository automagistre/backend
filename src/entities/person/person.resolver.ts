import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Person } from '@prisma/client';
import { PersonService } from './person.service';
import { PersonModel } from './models/person.model';
import { CreatePersonInput } from './inputs/create.input';
import { UpdatePersonInput } from './inputs/update.input';

@Resolver()
export class PersonResolver {
  constructor(private readonly personService: PersonService) {}

  @Query(() => [PersonModel], { name: 'persons', description: 'Все клиенты' })
  async getAllPersons(): Promise<Person[]> {
    return this.personService.findAll();
  }

  @Query(() => PersonModel || null, { name: 'person', description: 'Клиент по id' })
  async getPerson(@Args('id') id: string): Promise<PersonModel | null> {
    return this.personService.findOne(id);
  }

  @Mutation(() => PersonModel, { name: 'createOnePerson', description: 'Создать клиента' })
  async create(@Args('input') input: CreatePersonInput): Promise<PersonModel> {
    return this.personService.create(input);
  }

  @Mutation(() => PersonModel, { name: 'updateOnePerson', description: 'Обновить клиента' })
  async update(@Args('input') input: UpdatePersonInput): Promise<PersonModel> {
    return this.personService.update(input);
  }

  @Mutation(() => PersonModel, { name: 'deleteOnePerson', description: 'Удалить клиента' })
  async delete(@Args('id') id: string): Promise<PersonModel> {
    return this.personService.delete(id);
  }
}
