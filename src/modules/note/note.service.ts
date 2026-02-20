import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthContext } from 'src/common/user-id.store';
import { CreateNoteInput } from './inputs/create-note.input';
import { UpdateNoteInput } from './inputs/update-note.input';

@Injectable()
export class NoteService {
  constructor(private readonly prisma: PrismaService) {}

  private async validateSubject(subjectId: string): Promise<void> {
    const [order, car, person] = await Promise.all([
      this.prisma.order.findFirst({ where: { id: subjectId }, select: { id: true } }),
      this.prisma.car.findFirst({ where: { id: subjectId }, select: { id: true } }),
      this.prisma.person.findFirst({ where: { id: subjectId }, select: { id: true } }),
    ]);
    if (!order && !car && !person) {
      throw new NotFoundException('Subject not found (Order, Car or Person)');
    }
  }

  async findBySubject(ctx: AuthContext, subjectId: string) {
    const { tenantId } = ctx;
    return this.prisma.note.findMany({
      where: { subject: subjectId, tenantId, noteDelete: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(ctx: AuthContext, input: CreateNoteInput) {
    const { tenantId, userId } = ctx;
    await this.validateSubject(input.subjectId);
    return this.prisma.note.create({
      data: {
        subject: input.subjectId,
        type: input.type,
        text: input.text,
        isPublic: input.isPublic ?? false,
        tenantId,
        createdBy: userId,
      },
    });
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
    return this.prisma.note.update({
      where: { id: input.id },
      data,
    });
  }

  async softDelete(ctx: AuthContext, noteId: string, description?: string) {
    const { tenantId, userId } = ctx;
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, tenantId, noteDelete: null },
    });
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    return this.prisma.$transaction(async (tx) => {
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
  }
}
