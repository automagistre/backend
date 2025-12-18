import { Module } from '@nestjs/common';

import { PartService } from './part.service';
import { PartResolver } from './part.resolver';
import { PartPriceService } from './part-price.service';
import { PartDiscountService } from './part-discount.service';
import { PartCrossService } from './part-cross.service';
import { PartMotionService } from './part-motion.service';
import { PartRequiredAvailabilityService } from './part-required-availability.service';

@Module({
  imports: [],
  providers: [PartService, PartResolver, PartPriceService, PartDiscountService, PartCrossService, PartMotionService, PartRequiredAvailabilityService],
})
export class PartModule {}
