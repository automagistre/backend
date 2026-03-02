import {
  Args,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { OrganizationModel, RequisiteModel } from './models/organization.model';
import { OrganizationService } from './organization.service';
import {
  CreateOrganizationInput,
  UpdateOrganizationInput,
} from './inputs/organization.input';
import { PaginationArgs } from 'src/common/pagination.args';
import { PaginatedOrganizations } from './types/paginated-organizations.type';
import { Organization } from '@prisma/client';
import { CustomerTransactionService } from 'src/modules/customer-transaction/customer-transaction.service';
import { PaginatedCustomerTransactions } from 'src/modules/customer-transaction/types/paginated-customer-transactions.type';
import { CustomerCarRelationService } from 'src/modules/customer-car-relation/customer-car-relation.service';
import { CarModel } from 'src/modules/vehicle/models/car.model';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';

@Resolver(() => OrganizationModel)
@RequireTenant()
export class OrganizationResolver {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly customerTransactionService: CustomerTransactionService,
    private readonly customerCarRelationService: CustomerCarRelationService,
  ) {}

  @Query(() => PaginatedOrganizations)
  async organizations(
    @AuthContext() ctx: AuthContextType,
    @Args() pagination?: PaginationArgs,
    @Args('search', { nullable: true }) search?: string,
  ) {
    if (!pagination) {
      pagination = { take: undefined, skip: undefined };
    }
    const { take = 25, skip = 0 } = pagination;

    return this.organizationService.findMany(ctx, { take, skip, search });
  }

  @Query(() => OrganizationModel, { nullable: true })
  async organization(
    @AuthContext() ctx: AuthContextType,
    @Args('id') id: string,
  ) {
    return this.organizationService.findOne(ctx, id);
  }

  @Mutation(() => OrganizationModel)
  async createOneOrganization(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: CreateOrganizationInput,
  ) {
    return this.organizationService.create(ctx, input);
  }

  @Mutation(() => OrganizationModel)
  async updateOneOrganization(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: UpdateOrganizationInput,
  ) {
    return this.organizationService.update(ctx, input);
  }

  @Mutation(() => OrganizationModel)
  async deleteOneOrganization(
    @AuthContext() ctx: AuthContextType,
    @Args('id') id: string,
  ) {
    return this.organizationService.remove(ctx, id);
  }

  @ResolveField(() => BigInt, {
    description: 'Баланс по проводкам',
  })
  async operandBalance(
    @AuthContext() ctx: AuthContextType,
    @Parent() organization: OrganizationModel,
  ): Promise<bigint> {
    return this.customerTransactionService.getBalance(ctx, organization.id);
  }

  @ResolveField(() => PaginatedCustomerTransactions)
  async transactions(
    @AuthContext() ctx: AuthContextType,
    @Parent() organization: OrganizationModel,
    @Args() pagination: PaginationArgs,
    @Args('dateFrom', { nullable: true }) dateFrom?: Date,
    @Args('dateTo', { nullable: true }) dateTo?: Date,
  ) {
    const { take = 25, skip = 0 } = pagination;
    return this.customerTransactionService.findMany(ctx, {
      operandId: organization.id,
      take,
      skip,
      dateFrom,
      dateTo,
    });
  }

  @ResolveField(() => [CarModel], {
    description: 'Автомобили организации по истории заказов',
  })
  async cars(
    @AuthContext() ctx: AuthContextType,
    @Parent() organization: OrganizationModel,
    @Args('search', { nullable: true }) search?: string,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
  ): Promise<CarModel[]> {
    return (await this.customerCarRelationService.findCarsByCustomerId(
      ctx,
      organization.id,
      { search, take },
    )) as CarModel[];
  }

  @ResolveField(() => RequisiteModel, { nullable: true })
  async requisite(
    @Parent() organization: Organization,
  ): Promise<RequisiteModel | null> {
    const hasRequisite =
      organization.requisiteBank ||
      organization.requisiteLegalAddress ||
      organization.requisiteOgrn ||
      organization.requisiteInn ||
      organization.requisiteKpp ||
      organization.requisiteRs ||
      organization.requisiteKs ||
      organization.requisiteBik;

    if (!hasRequisite) {
      return null;
    }

    return {
      bank: organization.requisiteBank,
      legalAddress: organization.requisiteLegalAddress,
      ogrn: organization.requisiteOgrn,
      inn: organization.requisiteInn,
      kpp: organization.requisiteKpp,
      rs: organization.requisiteRs,
      ks: organization.requisiteKs,
      bik: organization.requisiteBik,
    };
  }
}
