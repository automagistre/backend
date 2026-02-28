import {
  Args,
  Int,
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
import { CarModel } from 'src/modules/vehicle/models/car.model';
import { CustomerCarRelationService } from 'src/modules/customer-car-relation/customer-car-relation.service';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';

@Resolver(() => PersonModel)
@RequireTenant()
export class PersonResolver {
  constructor(
    private readonly personService: PersonService,
    private readonly customerTransactionService: CustomerTransactionService,
    private readonly customerCarRelationService: CustomerCarRelationService,
  ) {}

  @Query(() => PaginatedPersons, {
    name: 'persons',
    description: 'Клиенты с пагинацией',
  })
  async getAllPersons(
    @AuthContext() ctx: AuthContextType,
    @Args() pagination?: PaginationArgs,
    @Args('search', { nullable: true }) search?: string,
  ) {
    if (!pagination) {
      pagination = { take: undefined, skip: undefined };
    }
    const { take = 25, skip = 0 } = pagination;

    return await this.personService.findMany(ctx, { take, skip, search });
  }

  @Query(() => PersonModel || null, {
    name: 'person',
    description: 'Клиент по id',
  })
  async getPerson(
    @AuthContext() ctx: AuthContextType,
    @Args('id') id: string,
  ): Promise<PersonModel | null> {
    return this.personService.findOne(ctx, id);
  }

  @Mutation(() => PersonModel, {
    name: 'createOnePerson',
    description: 'Создать клиента',
  })
  async create(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: CreatePersonInput,
  ): Promise<PersonModel> {
    return this.personService.create(ctx, input);
  }

  @Mutation(() => PersonModel, {
    name: 'updateOnePerson',
    description: 'Обновить клиента',
  })
  async update(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: UpdatePersonInput,
  ): Promise<PersonModel> {
    return this.personService.update(ctx, input);
  }

  @Mutation(() => PersonModel, {
    name: 'deleteOnePerson',
    description: 'Удалить клиента',
  })
  async delete(
    @AuthContext() ctx: AuthContextType,
    @Args('id') id: string,
  ): Promise<PersonModel> {
    return this.personService.delete(ctx, id);
  }

  @ResolveField(() => BigInt, {
    description: 'Баланс по проводкам (сумма customer_transaction по операнду)',
  })
  async operandBalance(
    @AuthContext() ctx: AuthContextType,
    @Parent() person: PersonModel,
  ): Promise<bigint> {
    return this.customerTransactionService.getBalance(ctx, person.id);
  }

  @ResolveField(() => PaginatedCustomerTransactions)
  async transactions(
    @AuthContext() ctx: AuthContextType,
    @Parent() person: PersonModel,
    @Args() pagination: PaginationArgs,
    @Args('dateFrom', { nullable: true }) dateFrom?: Date,
    @Args('dateTo', { nullable: true }) dateTo?: Date,
  ) {
    const { take = 25, skip = 0 } = pagination;
    return this.customerTransactionService.findMany(ctx, {
      operandId: person.id,
      take,
      skip,
      dateFrom,
      dateTo,
    });
  }

  @ResolveField(() => [CarModel], {
    description: 'Автомобили клиента по истории заказов',
  })
  async cars(
    @AuthContext() ctx: AuthContextType,
    @Parent() person: PersonModel,
    @Args('search', { nullable: true }) search?: string,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
  ): Promise<CarModel[]> {
    return (await this.customerCarRelationService.findCarsByCustomerId(
      ctx,
      person.id,
      { search, take },
    )) as CarModel[];
  }
}
