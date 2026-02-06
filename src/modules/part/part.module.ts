import { Module } from '@nestjs/common';

import { PartService } from './part.service';
import { PartResolver } from './part.resolver';
import { PartPriceService } from './part-price.service';
import { PartDiscountService } from './part-discount.service';
import { PartCrossService } from './part-cross.service';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { PartRequiredAvailabilityService } from './part-required-availability.service';
import { ReservationModule } from '../reservation/reservation.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [WarehouseModule, ReservationModule, SettingsModule],
  providers: [
    PartService,
    PartResolver,
    PartPriceService,
    PartDiscountService,
    PartCrossService,
    PartRequiredAvailabilityService,
  ],
})
export class PartModule {}
