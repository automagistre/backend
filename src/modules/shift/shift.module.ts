import { Module } from '@nestjs/common';
import { ShiftService } from './shift.service';
import { ShiftResolver } from './shift.resolver';

@Module({
  providers: [ShiftService, ShiftResolver],
  exports: [ShiftService],
})
export class ShiftModule {}
