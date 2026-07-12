import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthContext } from 'src/common/user-id.store';
import { CreateNoteInput } from './inputs/create-note.input';
import { UpdateNoteInput } from './inputs/update-note.input';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import {
  AuditAction,
  AuditEntityType,
  AuditScope,
} from 'src/modules/audit-log/enums/audit.enums';
import { DisplayContextService } from 'src/modules/display-context/display-context.service';
import { NoteType, NoteTypeLabel } from './enums/note-type.enum';
import { orderTitle } from 'src/common/utils/entity-title.util';
import { WarrantyPayer, WarrantyPayerLabel } from 'src/modules/order/enums/warranty-payer.enum';

/**
 * Маркер заметки-гарантийного случая: позволяет находить «ту самую» заметку
 * для upsert без отдельной сущности/колонки (см. warranty_payer_ui план, §1).
 */
export const WARRANTY_NOTE_PREFIX = '[Гарантия]. ';

/** Маркер начала причины в тексте гарантийной заметки — для парсинга при редактировании. */
export const WARRANTY_NOTE_REASON_MARKER = 'Причина: ';

type NoteRoot = {
  rootEntityType: AuditEntityType;
  scope: AuditScope;
  subjectDisplay: string;
};

type NoteRow = {
  id: string;
  subject: string;
  type: number;
  text: string;
  isPublic: boolean | null;
};

@Injectable()
export class NoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly displayContext: DisplayContextService,
  ) {}

  private async validateSubject(subjectId: string): Promise<void> {
    const [order, car, person, part] = await Promise.all([
      this.prisma.order.findFirst({
        where: { id: subjectId },
        select: { id: true },
      }),
      this.prisma.car.findFirst({
        where: { id: subjectId },
        select: { id: true },
      }),
      this.prisma.person.findFirst({
        where: { id: subjectId },
        select: { id: true },
      }),
      this.prisma.part.findFirst({
        where: { id: subjectId },
        select: { id: true },
      }),
    ]);
    if (!order && !car && !person && !part) {
      throw new NotFoundException('Subject not found');
    }
  }

  /** Домен субъекта заметки: root, scope и читаемая подпись «к чему относится». */
  private async resolveNoteRoot(subjectId: string): Promise<NoteRoot | null> {
    const order = await this.prisma.order.findFirst({
      where: { id: subjectId },
      select: { number: true },
    });
    if (order) {
      return {
        rootEntityType: AuditEntityType.ORDER,
        scope: AuditScope.TENANT,
        subjectDisplay: orderTitle(order.number),
      };
    }
    const car = await this.prisma.car.findFirst({
      where: { id: subjectId },
      select: { id: true },
    });
    if (car) {
      return {
        rootEntityType: AuditEntityType.CAR,
        scope: AuditScope.GROUP,
        subjectDisplay: (await this.displayContext.getCarDisplay(subjectId)) ?? '',
      };
    }
    const person = await this.prisma.person.findFirst({
      where: { id: subjectId },
      select: { id: true },
    });
    if (person) {
      return {
        rootEntityType: AuditEntityType.PERSON,
        scope: AuditScope.GROUP,
        subjectDisplay:
          (await this.displayContext.getPersonDisplay(subjectId)) ?? '',
      };
    }
    const part = await this.prisma.part.findFirst({
      where: { id: subjectId },
      select: { id: true },
    });
    if (part) {
      return {
        rootEntityType: AuditEntityType.PART,
        scope: AuditScope.GROUP,
        subjectDisplay: (await this.displayContext.getPartName(subjectId)) ?? '',
      };
    }
    return null;
  }

  /** Запись события по заметке в историю агрегата-субъекта. */
  private async auditNote(
    ctx: AuthContext,
    note: NoteRow,
    before: Partial<NoteRow> | null,
    after: Partial<NoteRow> | null,
    action?: AuditAction,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    const root = await this.resolveNoteRoot(note.subject);
    if (!root) return;
    const typeLabel = NoteTypeLabel[note.type] ?? 'Заметка';
    const displayName = [typeLabel, root.subjectDisplay]
      .filter(Boolean)
      .join(': ');
    await this.auditLog.record(client, ctx, {
      rootEntityType: root.rootEntityType,
      rootEntityId: note.subject,
      entityType: AuditEntityType.NOTE,
      entityId: note.id,
      scope: root.scope,
      action,
      before,
      after,
      entityDisplayName: displayName,
    });
  }

  async findBySubject(
    ctx: AuthContext,
    subjectId: string,
    isPublic?: boolean | null,
  ) {
    const { tenantId } = ctx;
    const where = {
      subject: subjectId,
      tenantId,
      noteDelete: null,
      ...(isPublic !== undefined && isPublic !== null && { isPublic }),
    };
    return this.prisma.note.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(ctx: AuthContext, input: CreateNoteInput) {
    const { tenantId, userId } = ctx;
    await this.validateSubject(input.subjectId);
    const note = await this.prisma.note.create({
      data: {
        subject: input.subjectId,
        type: input.type,
        text: input.text,
        isPublic: input.isPublic ?? false,
        tenantId,
        createdBy: userId,
      },
    });

    await this.auditNote(ctx, note, null, {
      text: note.text,
      type: note.type,
      isPublic: note.isPublic,
    });

    return note;
  }

  async update(ctx: AuthContext, input: UpdateNoteInput) {
    const { tenantId } = ctx;
    const existing = await this.prisma.note.findFirst({
      where: { id: input.id, tenantId, noteDelete: null },
    });
    if (!existing) {
      throw new NotFoundException('Note not found');
    }
    await this.validateSubject(existing.subject);
    const data: Record<string, unknown> = {};
    if (input.type !== undefined) data.type = input.type;
    if (input.text !== undefined) data.text = input.text;
    if (input.isPublic !== undefined) data.isPublic = input.isPublic;
    const updated = await this.prisma.note.update({
      where: { id: input.id },
      data,
    });

    await this.auditNote(
      ctx,
      updated,
      {
        text: existing.text,
        type: existing.type,
        isPublic: existing.isPublic,
      },
      {
        text: updated.text,
        type: updated.type,
        isPublic: updated.isPublic,
      },
    );

    return updated;
  }

  /**
   * Upsert заметки-гарантийного случая заказа (см. warranty_payer_ui план, §1/§2):
   * одна заметка на гарантийный случай — повторный вызов для того же заказа
   * редактирует существующую (последнюю с маркером {@link WARRANTY_NOTE_PREFIX}),
   * а не плодит новые. Вызывать внутри транзакции применения гарантии.
   */
  async upsertWarrantyNote(
    ctx: AuthContext,
    tx: Prisma.TransactionClient,
    orderId: string,
    reason: string,
    workPayer: WarrantyPayer | null,
    partsPayer: WarrantyPayer | null,
  ) {
    const { tenantId, userId } = ctx;
    const sentences: string[] = [];
    if (workPayer) {
      sentences.push(`Работы оплачивает ${WarrantyPayerLabel[workPayer]}.`);
    }
    if (partsPayer) {
      sentences.push(`Запчасти оплачивает ${WarrantyPayerLabel[partsPayer]}.`);
    }
    sentences.push(`${WARRANTY_NOTE_REASON_MARKER}${reason.trim()}`);
    const text = `${WARRANTY_NOTE_PREFIX}${sentences.join(' ')}`;

    const existing = await tx.note.findFirst({
      where: {
        subject: orderId,
        tenantId,
        type: NoteType.WARNING,
        text: { startsWith: WARRANTY_NOTE_PREFIX },
        noteDelete: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      if (existing.text === text) return existing;
      const updated = await tx.note.update({
        where: { id: existing.id },
        data: { text },
      });
      await this.auditNote(
        ctx,
        updated,
        { text: existing.text, type: existing.type, isPublic: existing.isPublic },
        { text: updated.text, type: updated.type, isPublic: updated.isPublic },
        undefined,
        tx,
      );
      return updated;
    }

    const created = await tx.note.create({
      data: {
        subject: orderId,
        type: NoteType.WARNING,
        text,
        isPublic: false,
        tenantId,
        createdBy: userId,
      },
    });
    await this.auditNote(
      ctx,
      created,
      null,
      { text: created.text, type: created.type, isPublic: created.isPublic },
      undefined,
      tx,
    );
    return created;
  }

  async softDelete(ctx: AuthContext, noteId: string, description?: string) {
    const { tenantId, userId } = ctx;
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, tenantId, noteDelete: null },
    });
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.noteDelete.create({
        data: {
          noteId,
          description: description ?? '',
          tenantId,
          createdBy: userId,
        },
      });
      return note;
    });

    await this.auditNote(
      ctx,
      note,
      { text: note.text, type: note.type, isPublic: note.isPublic },
      null,
      AuditAction.DELETE,
    );

    return result;
  }
}
