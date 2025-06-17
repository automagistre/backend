import { Module } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { HomeAssistantModule } from '../home-assistant/home-assistant.module';

@Module({
  imports: [HomeAssistantModule],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
