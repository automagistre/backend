import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Organization } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { PhoneNumberScalar } from 'src/common/scalars/phone.scaral';

@ObjectType({ description: 'Реквизиты организации' })
export class RequisiteModel {
  @Field(() => String, { nullable: true, description: 'Банк' })
  bank?: string | null;

  @Field(() => String, { nullable: true, description: 'Юридический адрес' })
  legalAddress?: string | null;

  @Field(() => String, { nullable: true, description: 'ОГРН' })
  ogrn?: string | null;

  @Field(() => String, { nullable: true, description: 'ИНН' })
  inn?: string | null;

  @Field(() => String, { nullable: true, description: 'КПП' })
  kpp?: string | null;

  @Field(() => String, { nullable: true, description: 'Расчетный счет' })
  rs?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Корреспондентский счет',
  })
  ks?: string | null;

  @Field(() => String, { nullable: true, description: 'БИК' })
  bik?: string | null;
}

@ObjectType({ description: 'Организация' })
export class OrganizationModel implements Organization {
  @Field(() => ID)
  id: string;

  @Field(() => String, { description: 'Название организации' })
  name: string;

  @Field(() => String, { nullable: true, description: 'Адрес' })
  address: string | null;

  @Field(() => PhoneNumberScalar, { nullable: true, description: 'Телефон' })
  telephone: string | null;

  @Field(() => PhoneNumberScalar, {
    nullable: true,
    description: 'Рабочий телефон',
  })
  officePhone: string | null;

  @Field(() => String, { nullable: true, description: 'Email' })
  email: string | null;

  @Field(() => Boolean, { description: 'Является контрагентом' })
  contractor: boolean;

  @Field(() => Boolean, { description: 'Является поставщиком' })
  seller: boolean;

  @Field(() => String)
  tenantGroupId: string;

  @Field(() => RequisiteModel, { nullable: true, description: 'Реквизиты' })
  requisite: RequisiteModel | null;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  createdBy: string | null;

  @Field(() => String, { description: 'Баланс' })
  balance: Decimal;

  // Поля для Prisma
  requisiteBank: string | null;
  requisiteLegalAddress: string | null;
  requisiteOgrn: string | null;
  requisiteInn: string | null;
  requisiteKpp: string | null;
  requisiteRs: string | null;
  requisiteKs: string | null;
  requisiteBik: string | null;
}
