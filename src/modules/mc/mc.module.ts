import { Module } from '@nestjs/common';
import { McWorkService } from './mc-work.service';
import { McWorkResolver } from './mc-work.resolver';
import { McEquipmentService } from './mc-equipment.service';
import { McEquipmentResolver } from './mc-equipment.resolver';

@Module({
  providers: [
    McWorkService,
    McWorkResolver,
    McEquipmentService,
    McEquipmentResolver,
  ],
  exports: [McWorkService, McEquipmentService],
})
export class McModule {}
