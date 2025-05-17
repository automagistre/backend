import { Module } from '@nestjs/common';
import { PersonService } from './person.service';
import { PersonResolver } from './person.resolver';

@Module({
  imports: [],
  controllers: [],
  providers: [PersonService, PersonResolver],
  exports: []
})
export class PersonModule {}
