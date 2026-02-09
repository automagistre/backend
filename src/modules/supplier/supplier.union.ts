import { createUnionType } from '@nestjs/graphql';
import { PersonModel } from 'src/modules/person/models/person.model';
import { OrganizationModel } from 'src/modules/organization/models/organization.model';

/** Персона или организация — используется для списков поставщиков и подрядчиков. */
export const CounterpartyUnion = createUnionType({
  name: 'Counterparty',
  description: 'Контрагент — персона или организация (поставщик/подрядчик)',
  types: () => [PersonModel, OrganizationModel] as const,
  resolveType(value: { firstname?: string | null; name?: string }) {
    if ('firstname' in value) return PersonModel;
    return OrganizationModel;
  },
});
