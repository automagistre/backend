import { Injectable } from '@nestjs/common';
import { AutomationHubService } from '../automation-hub/automation-hub.service';
import { CalendarService } from '../calendar/calendar.service';

@Injectable()
export class WebhookService {
  constructor(
    private readonly automationHubService: AutomationHubService,
    private readonly calendarService: CalendarService,
  ) {}

  async openThirdGateByClient(phoneNumber: string) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const queryPhone = phoneNumber.replace(/\D/g, '');

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
      await this.automationHubService.openRearGate()
    }
    else {
      throw new Error('No access');
    }
  }    
}
