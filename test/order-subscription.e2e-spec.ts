import { randomInt, randomUUID } from 'crypto';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { createClient, type Client } from 'graphql-ws';
import type { FormattedExecutionResult } from 'graphql';
import { PrismaClient } from 'src/generated/prisma/client';
import { DEV_USER_ID } from 'src/middlewares/user-id.middleware';

/**
 * Подписка orderUpdated по WebSocket доставляет обновление заказа
 * с вычисляемыми полями. Запуск: DATABASE_URL на БД с e2e/test в имени.
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

const ORDER_UPDATED = `
  subscription($orderId: ID!) {
    orderUpdated(orderId: $orderId) {
      id
      mileage
      canDelete
      isEditable
      closeValidation { canClose closeDeficiencies }
    }
  }
`;

describe('Подписка orderUpdated (e2e)', () => {
  let app: NestFastifyApplication;
  let ws: Client | undefined;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  const groupId = randomUUID();
  const tenantId = randomUUID();
  const orderId = randomUUID();

  beforeAll(async () => {
    await prisma.tenant_group.create({
      data: { id: groupId, identifier: `e2e-ws-${groupId}`, name: 'E2E ws' },
    });
    await prisma.tenant.create({
      data: {
        id: tenantId,
        group_id: groupId,
        identifier: `e2e-ws-${tenantId}`,
        name: 'E2E ws',
        public_id: randomInt(100_000, 999_999),
      },
    });
    await prisma.tenant_permission.create({
      data: { id: randomUUID(), user_id: DEV_USER_ID, tenant_id: tenantId },
    });
    await prisma.order.create({
      data: { id: orderId, tenantId, number: randomInt(1, 1_000_000) },
    });

    const moduleRef = await Test.createTestingModule({
      imports: [(await import('src/app.module')).AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await ws?.dispose();
    await app?.close();
    await prisma.order.deleteMany({ where: { id: orderId } });
    await prisma.tenant_permission.deleteMany({
      where: { tenant_id: tenantId },
    });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.tenant_group.deleteMany({ where: { id: groupId } });
    await prisma.$disconnect();
  });

  it('доставляет обновление заказа без ошибок', async () => {
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const client = createClient({
      url: `ws://127.0.0.1:${port}/api/v1/graphql`,
      connectionParams: { headers: { 'x-tenant-id': tenantId } },
      retryAttempts: 0,
    });
    ws = client;

    const received = new Promise<FormattedExecutionResult>(
      (resolve, reject) => {
        client.subscribe(
          { query: ORDER_UPDATED, variables: { orderId } },
          { next: resolve, error: reject, complete: () => undefined },
        );
      },
    );
    // Подписка регистрируется асинхронно после connection_ack
    await new Promise((resolve) => setTimeout(resolve, 500));

    const mutation = await app.inject({
      method: 'POST',
      url: '/api/v1/graphql',
      headers: { 'content-type': 'application/json', 'x-tenant-id': tenantId },
      payload: JSON.stringify({
        query:
          'mutation($input: UpdateOrderInput!) { updateOrder(input: $input) { id } }',
        variables: { input: { id: orderId, mileage: 12345 } },
      }),
    });
    expect(mutation.json()).not.toHaveProperty('errors');

    const event = await received;
    expect(event.errors).toBeUndefined();
    expect(event.data?.orderUpdated).toMatchObject({
      id: orderId,
      mileage: 12345,
      isEditable: true,
    });
  });
});
