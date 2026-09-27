import { Field, ID, ObjectType } from '@nestjs/graphql';

/**
 * Данные для печатных форм: юр. лицо из привязанной организации плюс торговая марка из настроек.
 * Собирается на лету, в базе отдельно не хранится.
 */
@ObjectType({ description: 'Реквизиты для печатных форм' })
export class TenantRequisitesModel {
  @Field(() => ID, { description: 'Организация, чьи реквизиты печатаются' })
  organizationId: string;

  @Field(() => String, { description: 'Тип по длине ИНН: OOO или IP' })
  type: string;

  @Field(() => String, { description: 'Название организации' })
  name: string;

  @Field(() => String, { nullable: true, description: 'Юридический адрес' })
  address: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Адрес сервиса (место оказания услуг / хранения)',
  })
  actualAddress: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Город в шапке договоров',
  })
  city: string | null;

  @Field(() => String, { nullable: true, description: 'Сайт' })
  site: string | null;

  @Field(() => String, { nullable: true, description: 'Email' })
  email: string | null;

  @Field(() => String, { nullable: true, description: 'URL логотипа' })
  logoUrl: string | null;

  @Field(() => [String], { description: 'Телефоны' })
  telephones: string[];

  @Field(() => String, { nullable: true, description: 'Банк' })
  bank: string | null;

  @Field(() => String, { nullable: true, description: 'ОГРН / ОГРНИП' })
  ogrn: string | null;

  @Field(() => String, { nullable: true, description: 'ИНН' })
  inn: string | null;

  @Field(() => String, { nullable: true, description: 'КПП' })
  kpp: string | null;

  @Field(() => String, { nullable: true, description: 'Расчётный счёт' })
  rs: string | null;

  @Field(() => String, { nullable: true, description: 'Корр. счёт' })
  ks: string | null;

  @Field(() => String, { nullable: true, description: 'БИК' })
  bik: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'URL страницы гарантии (QR)',
  })
  guarantyUrl: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'URL картинки в подвале печатных форм',
  })
  printFooterImageUrl: string | null;

  @Field(() => String, { nullable: true, description: 'ФИО руководителя' })
  head: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Должность руководителя',
  })
  headType: string | null;
}
