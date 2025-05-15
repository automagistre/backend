import { Module } from '@nestjs/common';

import { PartService } from './part.service';
import { PartResolver } from './part.resolver';
import { PartPriceService } from './part-price.service';

@Module({
  imports: [],
  providers: [PartService, PartResolver, PartPriceService],
})
export class PartModule {}
