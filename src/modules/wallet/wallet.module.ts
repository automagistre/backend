import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletResolver } from './wallet.resolver';
import { WalletTransactionService } from './wallet-transaction.service';
import { WalletTransactionResolver } from './wallet-transaction.resolver';
import { DisplayContextModule } from 'src/modules/display-context/display-context.module';
import { SettingsModule } from 'src/modules/settings/settings.module';

@Module({
  imports: [DisplayContextModule, SettingsModule],
  providers: [
    WalletService,
    WalletResolver,
    WalletTransactionService,
    WalletTransactionResolver,
  ],
  exports: [WalletService, WalletTransactionService],
})
export class WalletModule {}
