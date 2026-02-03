import { Module, forwardRef } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletResolver } from './wallet.resolver';
import { WalletTransactionService } from './wallet-transaction.service';
import { WalletTransactionResolver } from './wallet-transaction.resolver';
import { PersonModule } from 'src/modules/person/person.module';
import { OrderModule } from 'src/modules/order/order.module';

@Module({
  imports: [PersonModule, forwardRef(() => OrderModule)],
  providers: [
    WalletService,
    WalletResolver,
    WalletTransactionService,
    WalletTransactionResolver,
  ],
  exports: [WalletService, WalletTransactionService],
})
export class WalletModule {}
