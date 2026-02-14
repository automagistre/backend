import { Module, forwardRef } from '@nestjs/common';
import './enums/procurement-status.enum';
import { WarehouseService } from './warehouse.service';
import { PartMotionService } from './part-motion.service';
import { PartSupplyService } from './part-supply.service';
import { ProcurementService } from './procurement.service';
import { WarehouseResolver } from './warehouse.resolver';
import { ReservationModule } from '../reservation/reservation.module';

@Module({
  imports: [forwardRef(() => ReservationModule)],
  providers: [
    WarehouseService,
    PartMotionService,
    PartSupplyService,
    ProcurementService,
    WarehouseResolver,
  ],
  exports: [
    WarehouseService,
    PartMotionService,
    PartSupplyService,
    ProcurementService,
  ],
})
export class WarehouseModule {}
