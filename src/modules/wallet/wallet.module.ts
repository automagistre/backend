import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletResolver } from './wallet.resolver';
import { WalletTransactionService } from './wallet-transaction.service';
import { WalletTransactionResolver } from './wallet-transaction.resolver';
import { DisplayContextModule } from 'src/modules/display-context/display-context.module';

@Module({
  imports: [DisplayContextModule],
  providers: [
    WalletService,
    WalletResolver,
    WalletTransactionService,
    WalletTransactionResolver,
  ],
  exports: [WalletService, WalletTransactionService],
})
export class WalletModule {}
