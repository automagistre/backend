import { Module } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { HomeAssistantModule } from '../home-assistant/home-assistant.module';

@Module({
  imports: [HomeAssistantModule],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
