import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletResolver } from './wallet.resolver';
import { WalletTransactionService } from './wallet-transaction.service';
import { WalletTransactionResolver } from './wallet-transaction.resolver';
import { OrderModule } from 'src/modules/order/order.module';
import { PersonModule } from 'src/modules/person/person.module';

@Module({
  imports: [OrderModule, PersonModule],
  providers: [
    WalletService,
    WalletResolver,
    WalletTransactionService,
    WalletTransactionResolver,
  ],
  exports: [WalletService, WalletTransactionService],
})
export class WalletModule {}
