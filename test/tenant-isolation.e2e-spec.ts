import { randomInt, randomUUID } from 'crypto';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'src/generated/prisma/client';
import { DEV_USER_ID } from 'src/middlewares/user-id.middleware';

/**
 * Изоляция тенантов: пользователь с доступом только к тенанту A не видит
 * и не может удалить данные тенанта B (другая группа), а подмена X-Tenant-Id
 * на B отклоняется. Запуск: DATABASE_URL на пустую БД с именем *e2e*|*test*
 * и применёнными миграциями.
 */

const databaseUrl = process.env.DATABASE_URL ?? '';
const databaseName = new URL(databaseUrl || 'postgresql://x/none').pathname;
if (!/e2e|test/i.test(databaseName)) {
  throw new Error(
    `e2e запускается только на БД с e2e/test в имени, сейчас: ${databaseName}`,
  );
}

process.env.AUTH_SKIP_CHECK = 'true';
process.env.NODE_ENV ??= 'test';

interface GqlResponse {
  data?: Record<string, unknown> | null;
  errors?: { message: string }[];
}

describe('Изоляция тенантов (e2e)', () => {
  let app: NestFastifyApplication;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  const groupA = randomUUID();
  const groupB = randomUUID();
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const personA = randomUUID();
  const b = {
    person: randomUUID(),
    car: randomUUID(),
    order: randomUUID(),
    income: randomUUID(),
    wallet: randomUUID(),
    employee: randomUUID(),
    calendar: randomUUID(),
  };

  async function gql(
    query: string,
    variables: Record<string, unknown> = {},
    tenantId = tenantA,
  ): Promise<GqlResponse> {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/graphql',
      headers: { 'content-type': 'application/json', 'x-tenant-id': tenantId },
      payload: JSON.stringify({ query, variables }),
    });
    return response.json<GqlResponse>();
  }

  async function snapshotB() {
    return JSON.stringify(
      await Promise.all([
        prisma.person.findUnique({ where: { id: b.person } }),
        prisma.car.findUnique({ where: { id: b.car } }),
        prisma.order.findUnique({ where: { id: b.order } }),
        prisma.income.findUnique({ where: { id: b.income } }),
        prisma.wallet.findUnique({ where: { id: b.wallet } }),
        prisma.employee.findUnique({ where: { id: b.employee } }),
        prisma.calendarEntry.findUnique({ where: { id: b.calendar } }),
      ]),
      (_key, value: unknown) =>
        typeof value === 'bigint' ? value.toString() : value,
    );
  }

  beforeAll(async () => {
    for (const [id, suffix] of [
      [groupA, 'a'],
      [groupB, 'b'],
    ]) {
      await prisma.tenant_group.create({
        data: { id, identifier: `e2e-${suffix}-${id}`, name: `E2E ${suffix}` },
      });
    }
    for (const [id, groupId, suffix] of [
      [tenantA, groupA, 'a'],
      [tenantB, groupB, 'b'],
    ]) {
      await prisma.tenant.create({
        data: {
          id,
          group_id: groupId,
          identifier: `e2e-${suffix}-${id}`,
          name: `E2E ${suffix}`,
          public_id: randomInt(100_000, 999_999),
        },
      });
    }
    await prisma.tenant_permission.create({
      data: { id: randomUUID(), user_id: DEV_USER_ID, tenant_id: tenantA },
    });

    await prisma.person.create({
      data: {
        id: personA,
        tenantGroupId: groupA,
        contractor: false,
        seller: false,
        firstname: 'A',
      },
    });
    await prisma.person.create({
      data: {
        id: b.person,
        tenantGroupId: groupB,
        contractor: false,
        seller: false,
        firstname: 'B',
      },
    });
    await prisma.car.create({
      data: { id: b.car, tenantGroupId: groupB, mileage: 0 },
    });
    await prisma.order.create({
      data: { id: b.order, tenantId: tenantB, number: randomInt(1, 1_000_000) },
    });
    await prisma.income.create({
      data: { id: b.income, tenantId: tenantB, supplierId: b.person },
    });
    await prisma.wallet.create({
      data: {
        id: b.wallet,
        tenantId: tenantB,
        name: 'B',
        useInIncome: false,
        useInOrder: false,
        showInLayout: false,
        defaultInManualTransaction: false,
      },
    });
    await prisma.employee.create({
      data: {
        id: b.employee,
        tenantId: tenantB,
        personId: b.person,
        hiredAt: new Date(),
      },
    });
    await prisma.calendarEntry.create({
      data: { id: b.calendar, tenantId: tenantB },
    });

    const moduleRef = await Test.createTestingModule({
      imports: [(await import('src/app.module')).AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app?.close();
    await prisma.calendarEntry.deleteMany({ where: { id: b.calendar } });
    await prisma.employee.deleteMany({ where: { id: b.employee } });
    await prisma.wallet.deleteMany({ where: { id: b.wallet } });
    await prisma.income.deleteMany({ where: { id: b.income } });
    await prisma.order.deleteMany({ where: { id: b.order } });
    await prisma.car.deleteMany({ where: { id: b.car } });
    await prisma.person.deleteMany({
      where: { id: { in: [b.person, personA] } },
    });
    await prisma.tenant_permission.deleteMany({
      where: { tenant_id: { in: [tenantA, tenantB] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantA, tenantB] } },
    });
    await prisma.tenant_group.deleteMany({
      where: { id: { in: [groupA, groupB] } },
    });
    await prisma.$disconnect();
  });

  it('подмена X-Tenant-Id на чужой тенант отклоняется', async () => {
    const res = await gql(
      'query($id: ID!) { order(id: $id) { id } }',
      { id: b.order },
      tenantB,
    );
    expect(res.data?.order ?? null).toBeNull();
    expect(res.errors?.[0]?.message).toMatch(/denied/i);
  });

  it.each([
    ['person', 'query($id: String!) { person(id: $id) { id } }', 'person'],
    ['car', 'query($id: String!) { car(id: $id) { id } }', 'car'],
    ['order', 'query($id: ID!) { order(id: $id) { id } }', 'order'],
    ['income', 'query($id: ID!) { income(id: $id) { id } }', 'income'],
    ['wallet', 'query($id: String!) { wallet(id: $id) { id } }', 'wallet'],
    [
      'employee',
      'query($id: String!) { employee(id: $id) { id } }',
      'employee',
    ],
    [
      'calendar',
      'query($id: ID!) { calendarEntry(id: $id) { id } }',
      'calendarEntry',
    ],
  ] as const)('%s тенанта B не читается по id', async (key, query, field) => {
    const res = await gql(query, { id: b[key] });
    expect(res.data?.[field] ?? null).toBeNull();
  });

  it.each([
    ['persons', '{ persons(take: 100) { items { id } } }', b.person],
    ['cars', '{ cars(take: 100) { items { id } } }', b.car],
    ['orders', '{ orders(take: 100) { items { id } } }', b.order],
    ['incomes', '{ incomes(take: 100) { items { id } } }', b.income],
    ['wallets', '{ wallets(take: 100) { items { id } } }', b.wallet],
    [
      'employees',
      '{ employees(take: 100, includeFired: true) { items { id } } }',
      b.employee,
    ],
  ])('%s тенанта A не содержат данных B', async (field, query, id) => {
    const res = await gql(query);
    expect(res.errors).toBeUndefined();
    const items = (res.data?.[field] as { items: { id: string }[] }).items;
    expect(items.map((item) => item.id)).not.toContain(id);
  });

  it.each([
    [
      'deleteOnePerson',
      'mutation($id: String!) { deleteOnePerson(id: $id) { id } }',
      'person',
    ],
    [
      'deleteOneCar',
      'mutation($id: String!) { deleteOneCar(id: $id) { id } }',
      'car',
    ],
    ['deleteOrder', 'mutation($id: ID!) { deleteOrder(id: $id) }', 'order'],
    ['deleteIncome', 'mutation($id: ID!) { deleteIncome(id: $id) }', 'income'],
    [
      'deleteOneWallet',
      'mutation($id: String!) { deleteOneWallet(id: $id) { id } }',
      'wallet',
    ],
    [
      'deleteOneEmployee',
      'mutation($id: String!) { deleteOneEmployee(id: $id) { id } }',
      'employee',
    ],
    [
      'deleteCalendarEntry',
      'mutation($id: ID!) { deleteCalendarEntry(input: { id: $id, reason: NO_REASON }) }',
      'calendar',
    ],
  ] as const)('%s не трогает данные B', async (field, query, key) => {
    const before = await snapshotB();
    const res = await gql(query, { id: b[key] });
    expect(res.data?.[field] ?? null).not.toBe(true);
    expect(res.errors?.length ?? 0).toBeGreaterThan(0);
    expect(await snapshotB()).toBe(before);
  });

  it.each([
    [
      'updateOnePerson',
      'mutation($id: String!) { updateOnePerson(input: { id: $id, firstname: "X" }) { id } }',
      'person',
    ],
    [
      'updateOneCar',
      'mutation($id: ID!) { updateOneCar(input: { id: $id, description: "X" }) { id } }',
      'car',
    ],
    [
      'updateOrder',
      'mutation($id: ID!) { updateOrder(input: { id: $id, mileage: 1 }) { id } }',
      'order',
    ],
    [
      'updateOneWallet',
      'mutation($id: ID!) { updateOneWallet(input: { id: $id, name: "X" }) { id } }',
      'wallet',
    ],
    [
      'updateCalendarEntry',
      'mutation($id: ID!) { updateCalendarEntry(input: { id: $id, description: "X" }) { id } }',
      'calendar',
    ],
  ] as const)('%s не меняет данные B', async (field, query, key) => {
    const before = await snapshotB();
    const res = await gql(query, { id: b[key] });
    expect(res.data?.[field] ?? null).toBeNull();
    expect(await snapshotB()).toBe(before);
  });

  it('клиента нельзя перенести в чужую группу через tenantGroupId', async () => {
    await gql(
      'mutation($id: String!, $group: ID) { updateOnePerson(input: { id: $id, tenantGroupId: $group }) { id } }',
      { id: personA, group: groupB },
    );
    const person = await prisma.person.findUnique({ where: { id: personA } });
    expect(person?.tenantGroupId).toBe(groupA);
  });
});
