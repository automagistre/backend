import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Person } from '@prisma/client';
import { PersonService } from './person.service';
import { PersonModel } from './models/person.model';
import { CreatePersonInput } from './inputs/create.input';
import { UpdatePersonInput } from './inputs/update.input';
import { PaginationArgs } from 'src/common/pagination.args';
import { PaginatedPersons } from './inputs/paginatedPersons.type';

@Resolver()
export class PersonResolver {
  constructor(private readonly personService: PersonService) {}

  @Query(() => PaginatedPersons, { name: 'persons', description: 'Клиенты с пагинацией' })
  async getAllPersons(@Args() pagination?: PaginationArgs) {
    if (!pagination) {
      pagination = { take: undefined, skip: undefined };
    }
    const { take = 25, skip = 0 } = pagination;

    return await this.personService.findMany({ take, skip });
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
