import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PartRequiredAvailability } from 'src/generated/prisma/client';
import type { AuthContext } from 'src/common/user-id.store';

@Injectable()
export class PartRequiredAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async findForPart(
    ctx: AuthContext,
    partId: string,
  ): Promise<PartRequiredAvailability | null> {
    const { tenantId } = ctx;
    const availability = await this.prisma.partRequiredAvailability.findFirst({
      where: {
        partId,
        tenantId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Если последняя запись имеет значения 0-0, это означает что запасы не контролируются
    // Возвращаем null чтобы показать что запасы не заданы
    if (
      availability &&
      availability.orderFromQuantity === 0 &&
      availability.orderUpToQuantity === 0
    ) {
      return null;
    }

    return availability;
  }
}
