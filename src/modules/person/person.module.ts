import { Module } from '@nestjs/common';
import { PersonService } from './person.service';
import { PersonResolver } from './person.resolver';
import { PhoneNumberScalar } from 'src/common/scalars/phone.scaral';
import { CustomerTransactionModule } from 'src/modules/customer-transaction/customer-transaction.module';
import { CarModule } from 'src/modules/vehicle/car.module';

@Module({
  imports: [CustomerTransactionModule, CarModule],
  controllers: [],
  providers: [PersonService, PersonResolver, PhoneNumberScalar],
  exports: [PersonService],
})
export class PersonModule {}
