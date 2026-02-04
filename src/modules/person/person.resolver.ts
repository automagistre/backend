import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { PersonService } from './person.service';
import { PersonModel } from './models/person.model';
import { CreatePersonInput } from './inputs/create.input';
import { UpdatePersonInput } from './inputs/update.input';
import { PaginationArgs } from 'src/common/pagination.args';
import { PaginatedPersons } from './inputs/paginatedPersons.type';
import { CustomerTransactionService } from 'src/modules/customer-transaction/customer-transaction.service';
import { PaginatedCustomerTransactions } from 'src/modules/customer-transaction/types/paginated-customer-transactions.type';

@Resolver(() => PersonModel)
export class PersonResolver {
  constructor(
    private readonly personService: PersonService,
    private readonly customerTransactionService: CustomerTransactionService,
  ) {}

  @Query(() => PaginatedPersons, {
    name: 'persons',
    description: 'Клиенты с пагинацией',
  })
  async getAllPersons(
    @Args() pagination?: PaginationArgs,
    @Args('search', { nullable: true }) search?: string,
  ) {
    if (!pagination) {
      pagination = { take: undefined, skip: undefined };
    }
    const { take = 25, skip = 0 } = pagination;

    return await this.personService.findMany({ take, skip, search });
  }

  @Query(() => PersonModel || null, {
    name: 'person',
    description: 'Клиент по id',
  })
  async getPerson(@Args('id') id: string): Promise<PersonModel | null> {
    return this.personService.findOne(id);
  }

  @Mutation(() => PersonModel, {
    name: 'createOnePerson',
    description: 'Создать клиента',
  })
  async create(@Args('input') input: CreatePersonInput): Promise<PersonModel> {
    return this.personService.create(input);
  }

  @Mutation(() => PersonModel, {
    name: 'updateOnePerson',
    description: 'Обновить клиента',
  })
  async update(@Args('input') input: UpdatePersonInput): Promise<PersonModel> {
    return this.personService.update(input);
  }

  @Mutation(() => PersonModel, {
    name: 'deleteOnePerson',
    description: 'Удалить клиента',
  })
  async delete(@Args('id') id: string): Promise<PersonModel> {
    return this.personService.delete(id);
  }

  @ResolveField(() => BigInt, {
    description: 'Баланс по проводкам (сумма customer_transaction по операнду)',
  })
  async operandBalance(@Parent() person: PersonModel): Promise<bigint> {
    return this.customerTransactionService.getBalance(person.id);
  }

  @ResolveField(() => PaginatedCustomerTransactions)
  async transactions(
    @Parent() person: PersonModel,
    @Args() pagination: PaginationArgs,
    @Args('dateFrom', { nullable: true }) dateFrom?: Date,
    @Args('dateTo', { nullable: true }) dateTo?: Date,
  ) {
    const { take = 25, skip = 0 } = pagination;
    return this.customerTransactionService.findMany({
      operandId: person.id,
      take,
      skip,
      dateFrom,
      dateTo,
    });
  }
}
