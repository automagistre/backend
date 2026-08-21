import { Module } from '@nestjs/common';
import { StaffPositionService } from './staff-position.service';
import { StaffPositionResolver } from './staff-position.resolver';

@Module({
  providers: [StaffPositionService, StaffPositionResolver],
  exports: [StaffPositionService],
})
export class StaffPositionModule {}
