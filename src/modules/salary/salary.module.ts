import { Module } from '@nestjs/common';
import { SalaryService } from './salary.service';
import { EmployeeSalaryService } from './employee-salary.service';
import { EmployeeSalaryResolver } from './employee-salary.resolver';
import { SalaryScheduler } from './salary.scheduler';
import { EmployeeModule } from 'src/modules/employee/employee.module';
import { CustomerTransactionModule } from 'src/modules/customer-transaction/customer-transaction.module';
import { SettingsModule } from 'src/modules/settings/settings.module';

@Module({
  imports: [
    EmployeeModule,
    CustomerTransactionModule,
    SettingsModule,
  ],
  providers: [
    SalaryService,
    EmployeeSalaryService,
    EmployeeSalaryResolver,
    SalaryScheduler,
  ],
  exports: [SalaryService, EmployeeSalaryService],
})
export class SalaryModule {}
