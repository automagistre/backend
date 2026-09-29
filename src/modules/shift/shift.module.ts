import { Module } from '@nestjs/common';
import { ShiftService } from './shift.service';
import { ShiftResolver } from './shift.resolver';
import { ShiftSnapshotService } from './shift-snapshot.service';

@Module({
  providers: [ShiftService, ShiftResolver, ShiftSnapshotService],
  exports: [ShiftService, ShiftSnapshotService],
})
export class ShiftModule {}
