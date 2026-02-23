import { Injectable } from '@nestjs/common';
import { AutomationHubService } from '../automation-hub/automation-hub.service';
import { CalendarService } from '../calendar/calendar.service';
import type { AuthContext } from 'src/common/user-id.store';

const DEFAULT_TENANT_ID = '1ec13d33-3f41-6e3a-a0cb-02420a000f18';
const DEFAULT_TENANT_GROUP_ID = '1ec13d33-3f41-6cf0-b012-02420a000f18';
const SERVICE_USER_ID = '59861141-83b2-416c-b672-8ba8a1cb76b2';

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

    const ctx: AuthContext = {
      tenantId: DEFAULT_TENANT_ID,
      tenantGroupId: DEFAULT_TENANT_GROUP_ID,
      userId: SERVICE_USER_ID,
    };

    const [todayEntries, tomorrowEntries] = await Promise.all([
      this.calendarService.getEntriesByDate(ctx, today),
      this.calendarService.getEntriesByDate(ctx, tomorrow),
    ]);

    const allEntries = [...todayEntries, ...tomorrowEntries];
    const result = allEntries.some((entry) =>
      entry.calendarEntryOrderInfo?.some((info) => {
        return info.customer?.telephone?.replace(/\D/g, '') === queryPhone;
      }),
    );
    if (result) {
      await this.automationHubService.openRearGate();
    } else {
      throw new Error('No access');
    }
  }
}
