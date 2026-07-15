import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { NoteService, WARRANTY_NOTE_PREFIX } from './note.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { DisplayContextService } from 'src/modules/display-context/display-context.service';
import { NoteType } from './enums/note-type.enum';
import { createPrismaMock, type PrismaMock } from 'src/common/testing/prisma-mock';
import { makeCtx } from 'src/common/testing/auth-context';

describe('NoteService.createWarrantyNote', () => {
  let prisma: PrismaMock;
  let audit: DeepMockProxy<AuditLogService>;
  let displayContext: DeepMockProxy<DisplayContextService>;
  let service: NoteService;
  const ctx = makeCtx();

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = mockDeep<AuditLogService>();
    displayContext = mockDeep<DisplayContextService>();
    jest.mocked(prisma.order.findFirst).mockResolvedValue({ id: 'order-1', number: 1 } as any);

    service = new NoteService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditLogService,
      displayContext as unknown as DisplayContextService,
    );
  });

  it('создаёт заметку с маркером и причиной', async () => {
    const text = `${WARRANTY_NOTE_PREFIX}Брак прошлой работы`;
    jest.mocked(prisma.note.create).mockResolvedValue({
      id: 'note-1',
      text,
      type: NoteType.WARNING,
      isPublic: false,
    } as any);

    const result = await service.createWarrantyNote(
      ctx,
      prisma as any,
      'order-1',
      'Брак прошлой работы',
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

  it('создаёт новую заметку при повторном применении гарантии, не перезаписывая предыдущую', async () => {
    const text = `${WARRANTY_NOTE_PREFIX}Вторая причина`;
    jest.mocked(prisma.note.create).mockResolvedValue({
      id: 'note-2',
      text,
      type: NoteType.WARNING,
      isPublic: false,
    } as any);

    await service.createWarrantyNote(ctx, prisma as any, 'order-1', 'Вторая причина');

    expect(prisma.note.create).toHaveBeenCalledTimes(1);
    expect(prisma.note.update).not.toHaveBeenCalled();
    expect(prisma.note.findFirst).not.toHaveBeenCalled();
  });
});
