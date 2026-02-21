import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePartDiscountDto } from './dto/create-part-discount.dto';
import { PartDiscount } from 'src/generated/prisma/client';
import { normalizeMoneyAmount } from 'src/common/utils/money.util';
import { SettingsService } from 'src/modules/settings/settings.service';

@Injectable()
export class PartDiscountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  async create(
    createPartDiscountDto: CreatePartDiscountDto,
  ): Promise<PartDiscount> {
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    return this.prisma.partDiscount.create({
      data: {
        partId: createPartDiscountDto.partId,
        since: createPartDiscountDto.since,
        discountAmount: normalizeMoneyAmount(createPartDiscountDto.discountAmount),
        discountCurrencyCode: defaultCurrency,
        tenantId: createPartDiscountDto.tenantId,
        createdBy: createPartDiscountDto.createdBy,
      },
    });
  }

  findAllByPartId(partId: string, tenantId: string): Promise<PartDiscount[]> {
    return this.prisma.partDiscount.findMany({
      where: {
        partId,
        tenantId,
      },
      orderBy: {
        since: 'desc',
      },
    });
  }

  findActualDiscountPart(partId: string, tenantId: string): Promise<PartDiscount | null> {
    return this.prisma.partDiscount.findFirst({
      where: {
        partId,
        tenantId,
      },
      orderBy: {
        since: 'desc',
      },
    });
  }

  remove(id: string): Promise<PartDiscount> {
    return this.prisma.partDiscount.delete({
      where: {
        id,
      },
    });
  }
}
