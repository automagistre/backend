import { Module } from '@nestjs/common';
import { PersonService } from './person.service';
import { PersonResolver } from './person.resolver';
import { PhoneNumberScalar } from 'src/common/scalars/phone.scaral';
import { CustomerTransactionModule } from 'src/modules/customer-transaction/customer-transaction.module';

@Module({
  imports: [CustomerTransactionModule],
  controllers: [],
  providers: [PersonService, PersonResolver, PhoneNumberScalar],
  exports: [PersonService],
})
export class PersonModule {}
