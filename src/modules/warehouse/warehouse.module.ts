import { Module } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { PartMotionService } from './part-motion.service';

@Module({
  providers: [WarehouseService, PartMotionService],
  exports: [WarehouseService],
})
export class WarehouseModule {}
