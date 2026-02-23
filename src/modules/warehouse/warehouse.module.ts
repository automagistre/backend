import { Module, forwardRef } from '@nestjs/common';
import './enums/procurement-status.enum';
import { WarehouseService } from './warehouse.service';
import { PartMotionService } from './part-motion.service';
import { PartSupplyService } from './part-supply.service';
import { ProcurementService } from './procurement.service';
import { WarehouseResolver } from './warehouse.resolver';
import { MotionResolver } from './motion.resolver';
import { MotionSourceLoader } from './loaders/motion-source.loader';
import { ReservationModule } from '../reservation/reservation.module';
import { OrganizationModule } from '../organization/organization.module';
import { PersonModule } from '../person/person.module';

@Module({
  imports: [forwardRef(() => ReservationModule), OrganizationModule, PersonModule],
  providers: [
    WarehouseService,
    PartMotionService,
    PartSupplyService,
    ProcurementService,
    WarehouseResolver,
    MotionResolver,
    MotionSourceLoader,
  ],
  exports: [
    WarehouseService,
    PartMotionService,
    PartSupplyService,
    ProcurementService,
  ],
})
export class WarehouseModule {}
