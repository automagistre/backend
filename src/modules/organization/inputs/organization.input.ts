import { Field, ID, InputType, PartialType } from '@nestjs/graphql';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  Length,
  Matches,
} from 'class-validator';
import { PhoneNumberScalar } from 'src/common/scalars/phone.scaral';

@InputType({ description: 'Реквизиты организации' })
export class RequisiteInput {
  @IsOptional()
  @Field(() => String, { nullable: true, description: 'Банк' })
  bank?: string | null;

  @IsOptional()
  @Field(() => String, { nullable: true, description: 'Юридический адрес' })
  legalAddress?: string | null;

  @IsOptional()
  @Matches(/^\d+$/, { message: 'ОГРН может содержать только цифры' })
  @Field(() => String, { nullable: true, description: 'ОГРН' })
  ogrn?: string | null;

  @IsOptional()
  @Matches(/^\d+$/, { message: 'ИНН может содержать только цифры' })
  @Field(() => String, { nullable: true, description: 'ИНН' })
  inn?: string | null;

  @IsOptional()
  @Matches(/^\d+$/, { message: 'КПП может содержать только цифры' })
  @Field(() => String, { nullable: true, description: 'КПП' })
  kpp?: string | null;

  @IsOptional()
  @Length(20, 20, { message: 'Расчетный счет должен содержать 20 цифр' })
  @Matches(/^\d{20}$/, {
    message: 'Расчетный счет может содержать только цифры',
  })
  @Field(() => String, {
    nullable: true,
    description: 'Расчетный счет (20 цифр)',
  })
  rs?: string | null;

  @IsOptional()
  @Length(20, 20, {
    message: 'Корреспондентский счет должен содержать 20 цифр',
  })
  @Matches(/^\d{20}$/, {
    message: 'Корреспондентский счет может содержать только цифры',
  })
  @Field(() => String, {
    nullable: true,
    description: 'Корреспондентский счет (20 цифр)',
  })
  ks?: string | null;

  @IsOptional()
  @Matches(/^\d+$/, { message: 'БИК может содержать только цифры' })
  @Field(() => String, { nullable: true, description: 'БИК' })
  bik?: string | null;
}

@InputType()
export class CreateOrganizationInput {
  @Field(() => String, { description: 'Название организации' })
  name: string;

  @IsOptional()
  @Field(() => String, { nullable: true, description: 'Адрес' })
  address?: string | null;

  @IsOptional()
  @Field(() => PhoneNumberScalar, { nullable: true, description: 'Телефон' })
  telephone?: string | null;

  @IsOptional()
  @Field(() => PhoneNumberScalar, {
    nullable: true,
    description: 'Рабочий телефон',
  })
  officePhone?: string | null;

  @IsOptional()
  @IsEmail()
  @Field(() => String, { nullable: true, description: 'Email' })
  email?: string | null;

  @IsBoolean()
  @Field(() => Boolean, {
    description: 'Является контрагентом',
    defaultValue: false,
  })
  contractor: boolean;

  @IsBoolean()
  @Field(() => Boolean, {
    description: 'Является поставщиком',
    defaultValue: false,
  })
  seller: boolean;

  @IsOptional()
  @Field(() => RequisiteInput, { nullable: true, description: 'Реквизиты' })
  requisite?: RequisiteInput | null;
}

@InputType()
export class UpdateOrganizationInput extends PartialType(
  CreateOrganizationInput,
) {
  @Field(() => ID, { description: 'ID организации' })
  id: string;
}
