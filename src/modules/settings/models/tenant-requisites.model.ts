import { Field, ObjectType } from '@nestjs/graphql';

/** Реквизиты tenant для печати (заказ-наряд, счёт и т.п.) */
@ObjectType({ description: 'Реквизиты организации для печати документов' })
export class TenantRequisitesModel {
  @Field(() => String, { description: 'Тип: OOO или IP' })
  type: string;

  @Field(() => String, { description: 'Название организации' })
  name: string;

  @Field(() => String, { description: 'Адрес' })
  address: string;

  @Field(() => String, { nullable: true, description: 'Сайт' })
  site?: string | null;

  @Field(() => String, { nullable: true, description: 'Email' })
  email?: string | null;

  @Field(() => String, { description: 'Имя файла логотипа (в /img)' })
  logo: string;

  @Field(() => [String], { description: 'Телефоны' })
  telephones: string[];

  @Field(() => String, { description: 'Банк' })
  bank: string;

  @Field(() => String, { nullable: true, description: 'ОГРН' })
  ogrn?: string | null;

  @Field(() => String, { description: 'ИНН' })
  inn: string;

  @Field(() => String, { nullable: true, description: 'КПП' })
  kpp?: string | null;

  @Field(() => String, { description: 'Расчётный счёт' })
  rs: string;

  @Field(() => String, { description: 'Корр. счёт' })
  ks: string;

  @Field(() => String, { description: 'БИК' })
  bik: string;

  @Field(() => String, { description: 'URL страницы гарантии (QR)' })
  guarantyUrl: string;

  @Field(() => String, { description: 'ФИО руководителя' })
  head: string;

  @Field(() => String, { description: 'Должность руководителя' })
  headType: string;
}
