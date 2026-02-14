import { Args, ID, Int, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { OrganizationService } from 'src/modules/organization/organization.service';
import { PersonService } from 'src/modules/person/person.service';
import { IncomeService } from './income.service';
import { IncomeModel } from './models/income.model';
import { IncomePartModel } from './models/income-part.model';
import { PaginatedIncomes } from './types/paginated-incomes.type';
import { CreateIncomeInput } from './inputs/create-income.input';
import { CreateIncomePartInput } from './inputs/create-income-part.input';
import { UpdateIncomeInput } from './inputs/update-income.input';
import { UpdateIncomePartInput } from './inputs/update-income-part.input';

@Resolver(() => IncomeModel)
export class IncomeResolver {
  constructor(
    private readonly incomeService: IncomeService,
    private readonly personService: PersonService,
    private readonly organizationService: OrganizationService,
  ) {}

  @ResolveField('supplier')
  async supplier(@Parent() income: { supplierId: string }) {
    const organization = await this.organizationService.findOne(income.supplierId);
    if (organization) return organization;
    return this.personService.findOne(income.supplierId);
  }

  @Query(() => IncomeModel, {
    name: 'income',
    description: 'Приход по ID',
  })
  async income(@Args('id', { type: () => ID }) id: string): Promise<IncomeModel> {
    return this.incomeService.findById(id);
  }

  @Query(() => PaginatedIncomes, {
    name: 'incomes',
    description: 'Список приходов с пагинацией',
  })
  async incomes(
    @Args('skip', { type: () => Int, nullable: true }) skip?: number,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
    @Args('supplierId', { type: () => ID, nullable: true }) supplierId?: string,
  ): Promise<PaginatedIncomes> {
    return this.incomeService.findMany(skip ?? 0, take ?? 50, supplierId);
  }

  @Mutation(() => IncomeModel, {
    name: 'createIncome',
    description: 'Создать приход',
  })
  async createIncome(
    @Args('input') input: CreateIncomeInput,
  ): Promise<IncomeModel> {
    return this.incomeService.create(input);
  }

  @Mutation(() => IncomeModel, {
    name: 'updateIncome',
    description: 'Обновить приход (номер документа, только если не оприходован)',
  })
  async updateIncome(
    @Args('input') input: UpdateIncomeInput,
  ): Promise<IncomeModel> {
    return this.incomeService.update(input);
  }

  @Mutation(() => IncomePartModel, {
    name: 'createIncomePart',
    description: 'Добавить позицию в приход',
  })
  async createIncomePart(
    @Args('input') input: CreateIncomePartInput,
  ): Promise<IncomePartModel> {
    return this.incomeService.createIncomePart(input);
  }

  @Mutation(() => IncomePartModel, {
    name: 'updateIncomePart',
    description: 'Обновить позицию прихода',
  })
  async updateIncomePart(
    @Args('input') input: UpdateIncomePartInput,
  ): Promise<IncomePartModel> {
    return this.incomeService.updateIncomePart(input);
  }

  @Mutation(() => Boolean, {
    name: 'deleteIncomePart',
    description: 'Удалить позицию прихода',
  })
  async deleteIncomePart(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.incomeService.deleteIncomePart(id);
  }

  @Mutation(() => Boolean, {
    name: 'deleteIncome',
    description: 'Удалить приход (только если не оприходован)',
  })
  async deleteIncome(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.incomeService.deleteIncome(id);
  }

  @Mutation(() => IncomeModel, {
    name: 'accrueIncome',
    description: 'Оприходовать приход',
  })
  async accrueIncome(
    @Args('incomeId', { type: () => ID }) incomeId: string,
  ): Promise<IncomeModel> {
    return this.incomeService.accrue(incomeId);
  }
}
