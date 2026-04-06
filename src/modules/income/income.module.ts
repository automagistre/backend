import { Module, forwardRef } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { PersonModule } from '../person/person.module';
import { IncomeService } from './income.service';
import { IncomeResolver, IncomeAccrueResolver } from './income.resolver';
import { SettingsModule } from '../settings/settings.module';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { ReservationModule } from '../reservation/reservation.module';
import { OrderModule } from '../order/order.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [
    SettingsModule,
    PersonModule,
    OrganizationModule,
    WarehouseModule,
    WalletModule,
    forwardRef(() => ReservationModule),
    forwardRef(() => OrderModule),
  ],
  providers: [IncomeService, IncomeResolver, IncomeAccrueResolver],
  exports: [IncomeService],
})
export class IncomeModule {}
