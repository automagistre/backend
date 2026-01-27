import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PartRequiredAvailability } from 'src/generated/prisma/client';
import { TenantService } from 'src/common/services/tenant.service';

@Injectable()
export class PartRequiredAvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
  ) {}

  async findForPart(partId: string): Promise<PartRequiredAvailability | null> {
    const tenantId = await this.tenantService.getTenantId();
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
