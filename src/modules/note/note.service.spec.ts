import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { NoteService, WARRANTY_NOTE_PREFIX } from './note.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { DisplayContextService } from 'src/modules/display-context/display-context.service';
import { NoteType } from './enums/note-type.enum';
import { WarrantyPayer } from 'src/modules/order/enums/warranty-payer.enum';
import { createPrismaMock, type PrismaMock } from 'src/common/testing/prisma-mock';
import { makeCtx } from 'src/common/testing/auth-context';

describe('NoteService.upsertWarrantyNote', () => {
  let prisma: PrismaMock;
  let audit: DeepMockProxy<AuditLogService>;
  let displayContext: DeepMockProxy<DisplayContextService>;
  let service: NoteService;
  const ctx = makeCtx();

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = mockDeep<AuditLogService>();
    displayContext = mockDeep<DisplayContextService>();
    prisma.order.findFirst.mockResolvedValue({ id: 'order-1', number: 1 } as any);

    service = new NoteService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditLogService,
      displayContext as unknown as DisplayContextService,
    );
  });

  it('создаёт заметку с маркером и плательщиками работ/запчастей, если гарантийной заметки ещё нет', async () => {
    const text = `${WARRANTY_NOTE_PREFIX}Работы оплачивает Механик. Запчасти оплачивает Организация. Причина: Брак прошлой работы`;
    prisma.note.findFirst.mockResolvedValue(null);
    prisma.note.create.mockResolvedValue({
      id: 'note-1',
      text,
      type: NoteType.WARNING,
      isPublic: false,
    } as any);

    const result = await service.upsertWarrantyNote(
      ctx,
      prisma as any,
      'order-1',
      'Брак прошлой работы',
      WarrantyPayer.EXECUTOR,
      WarrantyPayer.ORGANIZATION,
    );

    expect(prisma.note.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subject: 'order-1',
        type: NoteType.WARNING,
        text,
        isPublic: false,
      }),
    });
    expect(result.id).toBe('note-1');
  });

  it('не включает предложение о плательщике, если такого типа позиций нет', async () => {
    const text = `${WARRANTY_NOTE_PREFIX}Работы оплачивает Механик. Причина: Брак прошлой работы`;
    prisma.note.findFirst.mockResolvedValue(null);
    prisma.note.create.mockResolvedValue({
      id: 'note-1',
      text,
      type: NoteType.WARNING,
      isPublic: false,
    } as any);

    await service.upsertWarrantyNote(
      ctx,
      prisma as any,
      'order-1',
      'Брак прошлой работы',
      WarrantyPayer.EXECUTOR,
      null,
    );

    expect(prisma.note.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ text }),
    });
  });

  it('обновляет существующую гарантийную заметку (upsert), а не создаёт новую', async () => {
    prisma.note.findFirst.mockResolvedValue({
      id: 'note-1',
      text: `${WARRANTY_NOTE_PREFIX}Причина: Старая причина`,
      type: NoteType.WARNING,
      isPublic: false,
    } as any);
    const text = `${WARRANTY_NOTE_PREFIX}Причина: Новая причина`;
    prisma.note.update.mockResolvedValue({
      id: 'note-1',
      text,
      type: NoteType.WARNING,
      isPublic: false,
    } as any);

    const result = await service.upsertWarrantyNote(
      ctx,
      prisma as any,
      'order-1',
      'Новая причина',
      null,
      null,
    );

    expect(prisma.note.update).toHaveBeenCalledWith({
      where: { id: 'note-1' },
      data: { text },
    });
    expect(prisma.note.create).not.toHaveBeenCalled();
    expect(result.id).toBe('note-1');
  });

  it('не трогает БД, если текст не изменился', async () => {
    prisma.note.findFirst.mockResolvedValue({
      id: 'note-1',
      text: `${WARRANTY_NOTE_PREFIX}Причина: Та же причина`,
      type: NoteType.WARNING,
      isPublic: false,
    } as any);

    await service.upsertWarrantyNote(
      ctx,
      prisma as any,
      'order-1',
      'Та же причина',
      null,
      null,
    );

    expect(prisma.note.update).not.toHaveBeenCalled();
    expect(prisma.note.create).not.toHaveBeenCalled();
  });
});
