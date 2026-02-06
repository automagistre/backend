import { Module } from '@nestjs/common';
import { SalaryService } from './salary.service';
import { EmployeeModule } from 'src/modules/employee/employee.module';
import { CustomerTransactionModule } from 'src/modules/customer-transaction/customer-transaction.module';

@Module({
  imports: [EmployeeModule, CustomerTransactionModule],
  providers: [SalaryService],
  exports: [SalaryService],
})
export class SalaryModule {}
