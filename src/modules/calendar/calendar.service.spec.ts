import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { CalendarService } from './calendar.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { DisplayContextService } from 'src/modules/display-context/display-context.service';
import { DeletionReason } from './inputs/calendarEntry.input';
import { AuditAction } from 'src/modules/audit-log/enums/audit.enums';
import { createPrismaMock, type PrismaMock } from 'src/common/testing/prisma-mock';
import { makeCtx } from 'src/common/testing/auth-context';

describe('CalendarService', () => {
  let prisma: PrismaMock;
  let audit: DeepMockProxy<AuditLogService>;
  let display: DeepMockProxy<DisplayContextService>;
  let service: CalendarService;
  const ctx = makeCtx();

  const entryWith = (over: Record<string, any> = {}) => ({
    id: 'ce1',
    calendarEntrySchedule: [{ date: new Date('2026-01-01T10:00:00Z'), duration: 'PT90M' }],
    calendarEntryOrderInfo: [
      { customerId: 'c1', carId: null, assigneeId: 'a1', description: 'desc' },
    ],
    ...over,
  });

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = mockDeep<AuditLogService>();
    display = mockDeep<DisplayContextService>();
    display.getOperandDisplayName.mockResolvedValue('Иванов Иван');
    service = new CalendarService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditLogService,
      display as unknown as DisplayContextService,
    );
  });

  describe('createEntry', () => {
    it('создаёт запись с orderInfo, пишет аудит и нормализует длительность', async () => {
      jest.mocked(prisma.calendarEntry.create).mockResolvedValue({ id: 'ce1' } as any);
      jest.mocked(prisma.calendarEntry.findFirst).mockResolvedValue(entryWith() as any);

      const result = await service.createEntry(ctx, {
        date: new Date('2026-01-01T10:00:00Z'),
        duration: 'PT90M',
        customerId: 'c1',
        assigneeId: 'a1',
        description: 'desc',
      } as any);

      const createArg = jest.mocked(prisma.calendarEntry.create).mock.calls[0][0].data as any;
      expect(createArg.calendarEntryOrderInfo).toBeDefined();
      expect(audit.record).toHaveBeenCalledTimes(1);
      // PT90M → нормализуется в PT1H30M
      expect((result as any).calendarEntrySchedule[0].duration).toBe('PT1H30M');
    });

    it('без участников/описания не создаёт orderInfo', async () => {
      jest.mocked(prisma.calendarEntry.create).mockResolvedValue({ id: 'ce1' } as any);
      jest.mocked(prisma.calendarEntry.findFirst).mockResolvedValue(
        entryWith({ calendarEntryOrderInfo: [] }) as any,
      );

      await service.createEntry(ctx, {
        date: new Date('2026-01-01T10:00:00Z'),
        duration: 'PT1H',
      } as any);

      const createArg = jest.mocked(prisma.calendarEntry.create).mock.calls[0][0].data as any;
      expect(createArg.calendarEntryOrderInfo).toBeUndefined();
    });
  });

  describe('updateEntry', () => {
    it('возвращает null, если запись не найдена', async () => {
      jest.mocked(prisma.calendarEntry.findFirst).mockResolvedValue(null as any);
      const res = await service.updateEntry(ctx, { id: 'missing' } as any);
      expect(res).toBeNull();
    });

    it('без изменений → возвращает существующую без транзакции', async () => {
      jest.mocked(prisma.calendarEntry.findFirst).mockResolvedValue(entryWith() as any);
      const res = await service.updateEntry(ctx, { id: 'ce1' } as any);
      expect(res).toBeTruthy();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('смена assignee → создаёт снапшот orderInfo и пишет аудит', async () => {
      jest.mocked(prisma.calendarEntry.findFirst)
        .mockResolvedValueOnce(entryWith() as any)
        .mockResolvedValueOnce(entryWith() as any);

      await service.updateEntry(ctx, { id: 'ce1', assigneeId: 'a2' } as any);

      expect(prisma.calendarEntryOrderInfo.create).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(audit.record).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteEntry', () => {
    it('создаёт запись удаления и аудит DELETE', async () => {
      jest.mocked(prisma.calendarEntry.findFirst).mockResolvedValue(entryWith() as any);

      await service.deleteEntry(ctx, {
        id: 'ce1',
        reason: DeletionReason.PLAN_ANOTHER_TIME,
        description: 'перенос',
      } as any);

      expect(prisma.calendarEntryDeletion.create).toHaveBeenCalledTimes(1);
      const delArg = jest.mocked(prisma.calendarEntryDeletion.create).mock.calls[0][0].data as any;
      expect(delArg.reason).toBe(2);
      expect(audit.record.mock.calls[0][2].action).toBe(AuditAction.DELETE);
    });
  });
});
