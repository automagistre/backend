import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePartPriceDto } from './dto/create-part-price.dto';
import { PartPrice } from '@prisma/client';
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
        ...createPartPriceDto,
        priceAmount: normalizeMoneyAmount(createPartPriceDto.priceAmount),
        priceCurrencyCode: defaultCurrency,
      },
    });
  }

  findAllByPartId(partId: string): Promise<PartPrice[]> {
    return this.prisma.partPrice.findMany({
      where: {
        partId,
      },
    });
  }

  findActualPricePart(partId: string): Promise<PartPrice | null> {
    return this.prisma.partPrice.findFirst({
      take: 1,
      where: {
        partId,
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
