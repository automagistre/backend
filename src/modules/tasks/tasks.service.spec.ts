/* eslint-disable @typescript-eslint/unbound-method -- jest-моки проверяются по ссылке на метод */
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { BadRequestException } from '@nestjs/common';
import { SettingsService } from 'src/modules/settings/settings.service';
import {
  createPrismaMock,
  type PrismaMock,
} from 'src/common/testing/prisma-mock';
import { makeCtx } from 'src/common/testing/auth-context';
import type { TaskModel } from './models/task.model';
import { TasksService } from './tasks.service';

describe('TasksService: модуль «Контроль качества»', () => {
  let prisma: PrismaMock;
  let settings: DeepMockProxy<SettingsService>;
  let service: TasksService;
  const ctx = makeCtx();
  const closeInput = {
    orderId: 'o1',
    orderNumber: 101,
    customerId: 'c1',
    orderTotalMinor: 100_00n,
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    settings = mockDeep<SettingsService>();
    service = new TasksService(prisma, settings);
  });

  it('при выключенном модуле закрытие заказа не создаёт задачу', async () => {
    settings.isQualityControlEnabled.mockResolvedValue(false);

    await service.createQualityControlTaskOnOrderClose(prisma, ctx, closeInput);

    expect(prisma.task.findFirst).not.toHaveBeenCalled();
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('при включённом модуле продолжает проверки перед созданием', async () => {
    settings.isQualityControlEnabled.mockResolvedValue(true);
    prisma.task.findFirst.mockResolvedValue({ id: 't1' } as TaskModel as never);

    await service.createQualityControlTaskOnOrderClose(prisma, ctx, closeInput);

    expect(prisma.task.findFirst).toHaveBeenCalled();
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('backfill при выключенном модуле отклоняется', async () => {
    settings.isQualityControlEnabled.mockResolvedValue(false);

    await expect(
      service.backfillQualityControlTasks(ctx, { days: 30 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.order.findMany).not.toHaveBeenCalled();
  });
});
