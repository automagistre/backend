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
      // Найти группы обеих запчастей
      const leftGroup = await tx.partCrossPart.findFirst({
        where: { partId },
      });

      const rightGroup = await tx.partCrossPart.findFirst({
        where: { partId: crossPartId },
      });

      if (!leftGroup && !rightGroup) {
        // Если обе не в группах - создать новую группу
        const newGroupId = uuidv6();
        await tx.partCrossPart.createMany({
          data: [
            { partCrossId: newGroupId, partId },
            { partCrossId: newGroupId, partId: crossPartId },
          ],
        });
      } else if (!leftGroup && rightGroup) {
        // Если одна в группе - добавить вторую в эту группу
        await tx.partCrossPart.create({
          data: {
            partCrossId: rightGroup.partCrossId,
            partId,
          },
        });
      } else if (leftGroup && !rightGroup) {
        // Если вторая не в группе - добавить её в группу первой
        await tx.partCrossPart.create({
          data: {
            partCrossId: leftGroup.partCrossId,
            partId: crossPartId,
          },
        });
      } else if (
        leftGroup &&
        rightGroup &&
        leftGroup.partCrossId !== rightGroup.partCrossId
      ) {
        // Если обе в разных группах - объединить группы
        await tx.partCrossPart.updateMany({
          where: { partCrossId: rightGroup.partCrossId },
          data: { partCrossId: leftGroup.partCrossId },
        });
      }
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
