import { Module } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { OrganizationResolver } from './organization.resolver';
import { CustomerTransactionModule } from 'src/modules/customer-transaction/customer-transaction.module';
import { CustomerCarRelationModule } from 'src/modules/customer-car-relation/customer-car-relation.module';

@Module({
  imports: [CustomerTransactionModule, CustomerCarRelationModule],
  providers: [OrganizationService, OrganizationResolver],
  exports: [OrganizationService],
})
export class OrganizationModule {}
