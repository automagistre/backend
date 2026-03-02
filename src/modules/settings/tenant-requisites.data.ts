/**
 * Реквизиты по identifier tenant (msk, kazan, shavlev).
 * Соответствует CRM Tenant.php getRequisites().
 * TODO: при необходимости — маппинг tenantId (UUID) → identifier, когда будут известны UUID.
 */
export const TENANT_REQUISITES_BY_IDENTIFIER: Record<
  string,
  {
    type: string;
    name: string;
    address: string;
    site?: string | null;
    email?: string | null;
    logo: string;
    telephones: string[];
    bank: string;
    ogrn?: string | null;
    inn: string;
    kpp?: string | null;
    rs: string;
    ks: string;
    bik: string;
    guarantyUrl: string;
    head: string;
    headType: string;
  }
> = {
  demo: {
    type: 'OOO',
    name: 'ООО "Автомагистр"',
    address: '115408, г.Москва, ул.Братеевская, д.16, к.1, кв. 345',
    site: 'www.automagistre.ru',
    email: 'info@automagistre.ru',
    logo: 'logo_automagistre_color.png',
    telephones: ['+7 (495) 984-81-82', '+7 (985) 929-40-87'],
    bank: 'ООО "Банк Точка"',
    ogrn: '5137746189060',
    inn: '7725812690',
    kpp: '772401001',
    rs: '40702810102500129508',
    ks: '30101810745374525104',
    bik: '044525104',
    guarantyUrl: 'https://www.automagistre.ru/gr',
    head: 'Сидоров К.М.',
    headType: 'Генеральный директор',
  },
  msk: {
    type: 'OOO',
    name: 'ООО "Автомагистр"',
    address: '115408, г.Москва, ул.Братеевская, д.16, к.1, кв. 345',
    site: 'www.automagistre.ru',
    email: 'info@automagistre.ru',
    logo: 'logo_automagistre_color.png',
    telephones: ['+7 (495) 984-81-82', '+7 (985) 929-40-87'],
    bank: 'ООО "Банк Точка"',
    ogrn: '5137746189060',
    inn: '7725812690',
    kpp: '772401001',
    rs: '40702810102500129508',
    ks: '30101810745374525104',
    bik: '044525104',
    guarantyUrl: 'https://www.automagistre.ru/gr',
    head: 'Сидоров К.М.',
    headType: 'Генеральный директор',
  },
  kazan: {
    type: 'IP',
    name: 'ИП Ахметзянов А.А.',
    address: 'г. Казань, Магистральная 33 к.1',
    site: 'www.automagistre.ru',
    email: 'info@automagistre.ru',
    logo: 'logo_automagistre_color.png',
    telephones: ['+7 (966) 260-10-90', '+7 (927) 244-48-68'],
    bank: 'АО «Тинькофф Банк»',
    ogrn: '318169000126792',
    inn: '166017663015',
    rs: '40802810500000686477',
    ks: '30101810145250000974',
    bik: '044525974',
    guarantyUrl: 'https://www.automagistre.ru/gr',
    head: 'Ахметзянов А.А.',
    headType: 'Индивидуальный предприниматель',
  },
  shavlev: {
    type: 'IP',
    name: 'ИП Щавлев В.А.',
    address:
      'Моск. обл., Орехово-Зуевский район, п. Пригородный, Малодубенское шоссе, 3 км, цех № 1',
    site: 'vk.com/smitavtoservis',
    email: null,
    logo: 'logo_smith.png',
    telephones: ['+7 (926) 214-56-65'],
    bank: 'ПАО СБЕРБАНК',
    ogrn: null,
    inn: '507303160627',
    rs: '40802810940000009848',
    ks: '30101810400000000225',
    bik: '044525225',
    guarantyUrl: 'https://vk.com/topic-51443133_40629700',
    head: 'Щавлев В.А.',
    headType: 'Индивидуальный предприниматель',
  },
};
