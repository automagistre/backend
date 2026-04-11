import { Module } from '@nestjs/common';
import { OrganizationModule } from 'src/modules/organization/organization.module';
import { PersonModule } from 'src/modules/person/person.module';
import { CustomerService } from './customer.service';

@Module({
  imports: [PersonModule, OrganizationModule],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
