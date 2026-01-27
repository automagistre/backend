import { Module } from '@nestjs/common';
import { PersonService } from './person.service';
import { PersonResolver } from './person.resolver';
import { PhoneNumberScalar } from 'src/common/scalars/phone.scaral';

@Module({
  imports: [],
  controllers: [],
  providers: [PersonService, PersonResolver, PhoneNumberScalar],
  exports: [PersonService],
})
export class PersonModule {}
