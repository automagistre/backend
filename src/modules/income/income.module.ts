import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { PersonModule } from '../person/person.module';
import { IncomeService } from './income.service';
import { IncomeResolver } from './income.resolver';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule, PersonModule, OrganizationModule],
  providers: [IncomeService, IncomeResolver],
  exports: [IncomeService],
})
export class IncomeModule {}
