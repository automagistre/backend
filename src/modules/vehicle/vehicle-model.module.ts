import { Module } from '@nestjs/common';
import { VehicleModelService } from './vehicle-model.service';
import { VahicleModelResolver } from './vahicle-model.resolver';

@Module({
  imports: [],
  controllers: [],
  providers: [VehicleModelService, VahicleModelResolver],
  exports: [],
})
export class VehicleModelModule {}
