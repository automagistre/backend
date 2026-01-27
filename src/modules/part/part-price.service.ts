import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePartPriceDto } from './dto/create-part-price.dto';
import { PartPrice } from '@prisma/client';
import {
  normalizeMoneyAmount,
  rubCurrencyCode,
} from 'src/common/utils/money.util';

@Injectable()
export class PartPriceService {
  constructor(private readonly prisma: PrismaService) {}
  async create(createPartPriceDto: CreatePartPriceDto): Promise<PartPrice> {
    return this.prisma.partPrice.create({
      data: {
        ...createPartPriceDto,
        priceAmount: normalizeMoneyAmount(createPartPriceDto.priceAmount),
        priceCurrencyCode: rubCurrencyCode(),
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
