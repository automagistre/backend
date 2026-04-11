import { Injectable } from '@nestjs/common';
import { OrganizationService } from 'src/modules/organization/organization.service';
import { PersonService } from 'src/modules/person/person.service';

export type CustomerPersonMatchState = 'MATCHED' | 'AMBIGUOUS' | 'NOT_FOUND';

export type CustomerPersonMatch = {
  personId: string | null;
  state: CustomerPersonMatchState;
};

@Injectable()
export class CustomerService {
  constructor(
    private readonly personService: PersonService,
    private readonly organizationService: OrganizationService,
  ) {}

  async resolvePersonMatchByPhone(
    tenantGroupId: string,
    phone: string | undefined,
  ): Promise<CustomerPersonMatch> {
    if (!phone) {
      return { personId: null, state: 'NOT_FOUND' };
    }

    const variants = this.toPhoneVariants(phone);
    const persons = await this.personService.findByPhonesInTenantGroup(
      tenantGroupId,
      variants,
      2,
    );

    if (persons.length === 1) {
      return {
        personId: persons[0]?.id ?? null,
        state: 'MATCHED',
      };
    }
    if (persons.length > 1) {
      return { personId: null, state: 'AMBIGUOUS' };
    }

    return { personId: null, state: 'NOT_FOUND' };
  }

  async resolveCustomerDisplayName(params: {
    tenantGroupId: string;
    personId: string | null;
    phone: string | undefined;
  }): Promise<string | null> {
    if (params.personId) {
      return this.personService.getDisplayNameById(params.personId);
    }

    if (!params.phone) {
      return null;
    }

    const variants = this.toPhoneVariants(params.phone);

    const persons = await this.personService.findByPhonesInTenantGroup(
      params.tenantGroupId,
      variants,
      2,
    );
    if (persons.length === 1) {
      const person = persons[0];
      if (!person) {
        return null;
      }
      return this.formatPersonName(person.firstname, person.lastname);
    }
    if (persons.length > 1) {
      return null;
    }

    const organizations =
      await this.organizationService.findByPhonesInTenantGroup(
        params.tenantGroupId,
        variants,
        2,
      );
    if (organizations.length === 1) {
      return organizations[0]?.name ?? null;
    }

    return null;
  }

  private toPhoneVariants(phone: string): string[] {
    const normalized = phone.trim();
    if (!normalized) {
      return [];
    }

    const variants = new Set<string>([normalized]);
    if (normalized.startsWith('+7') && normalized.length > 2) {
      variants.add(`8${normalized.slice(2)}`);
    } else if (normalized.startsWith('8') && normalized.length > 1) {
      variants.add(`+7${normalized.slice(1)}`);
    }

    return Array.from(variants);
  }

  private formatPersonName(
    firstname: string | null,
    lastname: string | null,
  ): string | null {
    return [firstname, lastname].filter(Boolean).join(' ').trim() || null;
  }
}
