import { Module } from '@nestjs/common';
import { ExpenseService } from './expense.service';
import { ExpenseResolver } from './expense.resolver';
import { WalletModule } from 'src/modules/wallet/wallet.module';

@Module({
  imports: [WalletModule],
  providers: [ExpenseService, ExpenseResolver],
  exports: [ExpenseService],
})
export class ExpenseModule {}
