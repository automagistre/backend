import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PartModel } from './models/part.model';
import { v6 as uuidv6 } from 'uuid';

@Injectable()
export class PartCrossService {
  constructor(private readonly prisma: PrismaService) {}

  async addCross(partId: string, crossPartId: string): Promise<void> {
    if (partId === crossPartId) {
      throw new Error('Нельзя создать кросс запчасти самой на себя');
    }

    await this.prisma.$transaction(async (tx) => {
      // Все группы, в которых уже состоит хотя бы одна из запчастей.
      // Из-за исторических данных одна и та же запчасть может оказаться
      // в нескольких группах, поэтому собираем их все.
      const memberships = await tx.partCrossPart.findMany({
        where: { partId: { in: [partId, crossPartId] } },
        select: { partCrossId: true },
      });

      const affectedGroupIds = [
        ...new Set(memberships.map((m) => m.partCrossId)),
      ];

      const existingMembers = affectedGroupIds.length
        ? await tx.partCrossPart.findMany({
            where: { partCrossId: { in: affectedGroupIds } },
            select: { partId: true },
          })
        : [];

      const mergedPartIds = [
        ...new Set([
          ...existingMembers.map((m) => m.partId),
          partId,
          crossPartId,
        ]),
      ];

      // Удаляем все затронутые группы целиком и пересоздаём как одну новую,
      // чтобы исключить конфликт уникальности (partCrossId, partId)
      // при «слиянии» через update.
      if (affectedGroupIds.length) {
        await tx.partCrossPart.deleteMany({
          where: { partCrossId: { in: affectedGroupIds } },
        });
      }

      const newGroupId = uuidv6();
      await tx.partCrossPart.createMany({
        data: mergedPartIds.map((id) => ({
          partCrossId: newGroupId,
          partId: id,
        })),
        skipDuplicates: true,
      });
    });
  }

  async removeCross(partId: string): Promise<void> {
    await this.prisma.partCrossPart.deleteMany({
      where: { partId },
    });
  }

  async getCrossParts(partId: string): Promise<PartModel[]> {
    const crossRelation = await this.prisma.partCrossPart.findFirst({
      where: { partId },
    });

    if (!crossRelation) {
      return [];
    }

    const crossParts = await this.prisma.partCrossPart.findMany({
      where: {
        partCrossId: crossRelation.partCrossId,
        partId: { not: partId }, // Исключаем саму запчасть
      },
      include: {
        part: {
          include: {
            manufacturer: true,
          },
        },
      },
    });

    return crossParts.map((cp) => cp.part);
  }
}
