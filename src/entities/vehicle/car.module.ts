import { Module } from '@nestjs/common';
import { VehicleModelModule } from './vehicle-model.module';
import { CarResolver } from './car.resolver';
import { CarService } from './car.service';
import { GosNomerRUScalar } from 'src/common/scalars/gosnomer-ru.scalar';
import { VINScalar } from 'src/common/scalars/vin.scalar';

@Module({
  imports: [VehicleModelModule],
  controllers: [],
  providers: [CarService, CarResolver, VINScalar, GosNomerRUScalar],
  exports: [],
})
export class CarModule {}
