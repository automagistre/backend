import { Module} from '@nestjs/common';
import { CustomerTransactionService } from './customer-transaction.service';
import { CustomerTransactionResolver } from './customer-transaction.resolver';
import { WalletModule } from 'src/modules/wallet/wallet.module';
import { DisplayContextModule } from 'src/modules/display-context/display-context.module';

@Module({
  imports: [WalletModule, DisplayContextModule],
  providers: [CustomerTransactionService, CustomerTransactionResolver],
  exports: [CustomerTransactionService],
})
export class CustomerTransactionModule {}
