import { Module } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { EmployeeResolver } from './employee.resolver';
import { SettingsModule } from 'src/modules/settings/settings.module';

@Module({
  imports: [SettingsModule],
  providers: [EmployeeService, EmployeeResolver],
  exports: [EmployeeService],
})
export class EmployeeModule {}
