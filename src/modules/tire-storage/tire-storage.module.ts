import { Module, forwardRef } from '@nestjs/common';
import { PersonModule } from '../person/person.module';
import { CarModule } from '../vehicle/car.module';
import { OrderModule } from '../order/order.module';
import { SettingsModule } from '../settings/settings.module';
import { AppUserModule } from '../app-user/app-user.module';
import { TireStorageService } from './tire-storage.service';
import { TireStorageResolver } from './tire-storage.resolver';
import './enums/tire-storage-status.enum';
import './enums/tire-season.enum';

@Module({
  imports: [
    SettingsModule,
    PersonModule,
    CarModule,
    AppUserModule,
    forwardRef(() => OrderModule),
  ],
  providers: [TireStorageService, TireStorageResolver],
  exports: [TireStorageService],
})
export class TireStorageModule {}
