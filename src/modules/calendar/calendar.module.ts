import { Module } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { HomeAssistantModule } from '../home-assistant/home-assistant.module';
import {
  CalendarEntryOrderInfoResolver,
  CalendarResolver,
} from './calendar.resolver';
import { EmployeeModule } from '../employee/employee.module';
import { PersonModule } from '../person/person.module';
import { CarModule } from '../vehicle/car.module';

@Module({
  imports: [HomeAssistantModule, EmployeeModule, PersonModule, CarModule],
  providers: [
    CalendarService,
    CalendarResolver,
    CalendarEntryOrderInfoResolver,
  ],
  exports: [CalendarService],
})
export class CalendarModule {}
