import { Controller, Get, Query } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { HomeAssistantService } from '../home-assistant/home-assistant.service';

const GATE_ENTITY_ID = 'switch.rear_gate_open';

@Controller('calendar')
export class CalendarController {
  constructor(
    private readonly calendarService: CalendarService,
    private readonly homeAssistantService: HomeAssistantService,
  ) {}

  @Get('access-by-phone')
  async checkPhone(@Query('phone') phone: string): Promise<boolean> {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const queryPhone = phone.replace(/\D/g, '');
    const homeAssistant = await this.homeAssistantService.callService(
      'switch',
      'turn_on',
      { entity_id: GATE_ENTITY_ID },
    );

    const [todayEntries, tomorrowEntries] = await Promise.all([
      this.calendarService.getEntriesByDate(today),
      this.calendarService.getEntriesByDate(tomorrow),
    ]);

    const allEntries = [...todayEntries, ...tomorrowEntries];
    const result = allEntries.some((entry) =>
      entry.calendarEntryOrderInfo?.some((info) => {
        return info.customer?.telephone?.replace(/\D/g, '') === queryPhone;
      }),
    );
    if (result) {
      await this.homeAssistantService.callService(
        'switch',
        'turn_off',
        { entity_id: GATE_ENTITY_ID },
      );
    }
    return result;
  }
}
