import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePartPriceDto } from './dto/create-part-price.dto';
import { PartPrice } from 'src/generated/prisma/client';
import { normalizeMoneyAmount } from 'src/common/utils/money.util';
import { SettingsService } from 'src/modules/settings/settings.service';

@Injectable()
export class PartPriceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}
  async create(createPartPriceDto: CreatePartPriceDto): Promise<PartPrice> {
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    return this.prisma.partPrice.create({
      data: {
        partId: createPartPriceDto.partId,
        since: createPartPriceDto.since,
        priceAmount: normalizeMoneyAmount(createPartPriceDto.priceAmount),
        priceCurrencyCode: defaultCurrency,
        tenantId: createPartPriceDto.tenantId,
        createdBy: createPartPriceDto.createdBy,
      },
    });
  }

  findAllByPartId(partId: string, tenantId: string): Promise<PartPrice[]> {
    return this.prisma.partPrice.findMany({
      where: {
        partId,
        tenantId,
      },
      orderBy: {
        since: 'desc',
      },
    });
  }

  findActualPricePart(
    partId: string,
    tenantId: string,
  ): Promise<PartPrice | null> {
    return this.prisma.partPrice.findFirst({
      where: {
        partId,
        tenantId,
      },
      orderBy: {
        since: 'desc',
      },
    });
  }

  remove(id: string): Promise<PartPrice> {
    return this.prisma.partPrice.delete({
      where: {
        id,
      },
    });
  }
}
