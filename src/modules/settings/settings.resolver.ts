import { Query, Resolver } from '@nestjs/graphql';
import { SettingsModel } from './settings.model';
import { SettingsService } from './settings.service';

@Resolver()
export class SettingsResolver {
  constructor(private readonly settingsService: SettingsService) {}

  @Query(() => SettingsModel, {
    description: 'Глобальные настройки приложения',
  })
  async settings(): Promise<SettingsModel> {
    return this.settingsService.getSettings();
  }
}
