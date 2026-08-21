import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { StaffPositionService } from './staff-position.service';
import { StaffPositionSettingKey } from './enums/staff-position-setting.enum';
import {
  createPrismaMock,
  type PrismaMock,
} from 'src/common/testing/prisma-mock';
import { makeCtx } from 'src/common/testing/auth-context';
import { PrismaService } from 'src/prisma/prisma.service';

describe('StaffPositionService', () => {
  let prisma: PrismaMock;
  let service: StaffPositionService;
  const ctx = makeCtx();

  const position = {
    id: 'pos-1',
    name: 'Механик',
    sortOrder: 10,
    archivedAt: null,
    tenantId: 'tenant-1',
    createdAt: new Date(),
    createdBy: 'user-1',
    settings: [{ positionId: 'pos-1', key: 'WORK_EXECUTOR', value: true }],
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new StaffPositionService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('не считает архивную должность занятым именем', async () => {
      jest
        .mocked(prisma.staffPosition.findFirst)
        .mockResolvedValue(null as any);
      jest
        .mocked(prisma.staffPosition.create)
        .mockResolvedValue(position as any);

      await service.create(ctx, { name: 'Механик' });

      expect(prisma.staffPosition.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: 'Механик',
            archivedAt: null,
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('не даёт менять архивную', async () => {
      jest.mocked(prisma.staffPosition.findFirst).mockResolvedValue({
        ...position,
        archivedAt: new Date(),
      } as any);

      await expect(
        service.update(ctx, { id: 'pos-1', name: 'Слесарь' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('отклоняет цвет вне палитры', async () => {
      jest
        .mocked(prisma.staffPosition.findFirst)
        .mockResolvedValue(position as any);

      await expect(
        service.update(ctx, {
          id: 'pos-1',
          settings: [
            {
              key: StaffPositionSettingKey.CALENDAR_COLOR,
              value: 'var(--p-red-500)',
            },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.staffPositionSetting.createMany).not.toHaveBeenCalled();
    });

    it('отклоняет значение не того типа', async () => {
      jest
        .mocked(prisma.staffPosition.findFirst)
        .mockResolvedValue(position as any);

      await expect(
        service.update(ctx, {
          id: 'pos-1',
          settings: [
            { key: StaffPositionSettingKey.WORK_EXECUTOR, value: 'yes' },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('выключенный тумблер и пустое значение строк не создают', async () => {
      jest
        .mocked(prisma.staffPosition.findFirst)
        .mockResolvedValue(position as any);
      jest
        .mocked(prisma.staffPosition.update)
        .mockResolvedValue(position as any);

      await service.update(ctx, {
        id: 'pos-1',
        settings: [
          { key: StaffPositionSettingKey.CALENDAR_PARTICIPANT, value: true },
          {
            key: StaffPositionSettingKey.CALENDAR_EXCLUDE_FROM_AUTO_ASSIGN,
            value: false,
          },
          { key: StaffPositionSettingKey.CALENDAR_COLOR, value: null },
        ],
      });

      expect(prisma.staffPositionSetting.createMany).toHaveBeenCalledWith({
        data: [
          {
            positionId: 'pos-1',
            key: StaffPositionSettingKey.CALENDAR_PARTICIPANT,
            value: true,
          },
        ],
      });
    });
  });

  describe('remove', () => {
    it('NotFound, если должности нет', async () => {
      jest
        .mocked(prisma.staffPosition.findFirst)
        .mockResolvedValue(null as any);
      await expect(service.remove(ctx, 'pos-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('повторный вызов на архивной не трогает archivedAt', async () => {
      const archived = { ...position, archivedAt: new Date('2026-01-01') };
      jest
        .mocked(prisma.staffPosition.findFirst)
        .mockResolvedValue(archived as any);

      const result = await service.remove(ctx, 'pos-1');

      expect(result.archivedAt).toEqual(archived.archivedAt);
      expect(prisma.staffPosition.update).not.toHaveBeenCalled();
      expect(prisma.staffPosition.delete).not.toHaveBeenCalled();
    });

    it('Conflict, если должность на действующих сотрудниках', async () => {
      jest
        .mocked(prisma.staffPosition.findFirst)
        .mockResolvedValue(position as any);
      jest
        .mocked(prisma.employeeStaffPosition.count)
        .mockResolvedValue(2 as any);

      await expect(service.remove(ctx, 'pos-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('архивирует, если привязаны только уволенные', async () => {
      jest
        .mocked(prisma.staffPosition.findFirst)
        .mockResolvedValue(position as any);
      jest
        .mocked(prisma.employeeStaffPosition.count)
        .mockResolvedValueOnce(0 as any)
        .mockResolvedValueOnce(1 as any);
      jest.mocked(prisma.staffPosition.update).mockResolvedValue({
        ...position,
        archivedAt: new Date(),
      } as any);

      const result = await service.remove(ctx, 'pos-1');

      expect(result.archivedAt).toBeTruthy();
      expect(prisma.staffPosition.delete).not.toHaveBeenCalled();
    });

    it('удаляет физически, если привязок нет', async () => {
      jest
        .mocked(prisma.staffPosition.findFirst)
        .mockResolvedValue(position as any);
      jest
        .mocked(prisma.employeeStaffPosition.count)
        .mockResolvedValue(0 as any);
      jest
        .mocked(prisma.staffPosition.delete)
        .mockResolvedValue(position as any);

      await service.remove(ctx, 'pos-1');

      expect(prisma.staffPosition.delete).toHaveBeenCalledWith({
        where: { id: 'pos-1' },
      });
    });
  });

  describe('unarchive', () => {
    it('не возвращает, если активная с тем же именем уже есть', async () => {
      jest
        .mocked(prisma.staffPosition.findFirst)
        .mockResolvedValueOnce({
          ...position,
          archivedAt: new Date(),
        } as any)
        .mockResolvedValueOnce({ id: 'pos-2', name: 'Механик' } as any);

      await expect(service.unarchive(ctx, 'pos-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});
