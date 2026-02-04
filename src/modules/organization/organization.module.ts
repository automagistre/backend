import { Module } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { OrganizationResolver } from './organization.resolver';
import { CustomerTransactionModule } from 'src/modules/customer-transaction/customer-transaction.module';

@Module({
  imports: [CustomerTransactionModule],
  providers: [OrganizationService, OrganizationResolver],
  exports: [OrganizationService],
})
export class OrganizationModule {}
