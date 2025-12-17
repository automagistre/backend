import { Module } from '@nestjs/common';

import { PartService } from './part.service';
import { PartResolver } from './part.resolver';
import { PartPriceService } from './part-price.service';
import { PartDiscountService } from './part-discount.service';
import { PartCrossService } from './part-cross.service';

@Module({
  imports: [],
  providers: [PartService, PartResolver, PartPriceService, PartDiscountService, PartCrossService],
})
export class PartModule {}
