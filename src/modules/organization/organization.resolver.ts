import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { OrganizationModel, RequisiteModel } from './models/organization.model';
import { OrganizationService } from './organization.service';
import { CreateOrganizationInput, UpdateOrganizationInput } from './inputs/organization.input';
import { PaginationArgs } from 'src/common/pagination.args';
import { PaginatedOrganizations } from './types/paginated-organizations.type';
import { Organization } from '@prisma/client';

@Resolver(() => OrganizationModel)
export class OrganizationResolver {
  constructor(private readonly organizationService: OrganizationService) {}

  @Query(() => PaginatedOrganizations)
  async organizations(
    @Args() pagination?: PaginationArgs,
    @Args('search', { nullable: true }) search?: string,
  ) {
    if (!pagination) {
      pagination = { take: undefined, skip: undefined };
    }
    const { take = 25, skip = 0 } = pagination;

    const itemsPaginated = await this.organizationService.findMany({
      take,
      skip,
      search,
    });
    return itemsPaginated;
  }

  @Query(() => OrganizationModel, { nullable: true })
  async organization(@Args('id') id: string) {
    return this.organizationService.findOne(id);
  }

  @Mutation(() => OrganizationModel)
  async createOneOrganization(@Args('input') input: CreateOrganizationInput) {
    return await this.organizationService.create(input);
  }

  @Mutation(() => OrganizationModel)
  async updateOneOrganization(@Args('input') input: UpdateOrganizationInput) {
    return await this.organizationService.update(input);
  }

  @Mutation(() => OrganizationModel)
  async deleteOneOrganization(@Args('id') id: string) {
    return await this.organizationService.remove(id);
  }

  @ResolveField(() => RequisiteModel, { nullable: true })
  async requisite(@Parent() organization: Organization): Promise<RequisiteModel | null> {
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

