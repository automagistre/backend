import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from 'src/prisma/prisma.service';

export type PrismaMock = DeepMockProxy<PrismaService>;

/**
 * Глубокий мок PrismaService для юнит-тестов сервисов.
 * `$transaction(cb)` исполняет callback с тем же мок-клиентом (как в проде —
 * сервисы пишут через переданный tx). Для массива промисов — Promise.all.
 */
export function createPrismaMock(): PrismaMock {
  const prisma = mockDeep<PrismaService>();
  prisma.$transaction.mockImplementation((arg: any) =>
    typeof arg === 'function' ? arg(prisma) : Promise.all(arg),
  );
  return prisma;
}
