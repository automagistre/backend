import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CogsModule } from 'src/modules/cogs/cogs.module';
import { EmployeeModule } from 'src/modules/employee/employee.module';
import { SettingsModule } from 'src/modules/settings/settings.module';
import { ProfitService } from './profit.service';
import './enums/profit-line-kind.enum';
import './enums/profit-cost-basis.enum';
import './enums/profit-origin.enum';

@Module({
  imports: [PrismaModule, CogsModule, EmployeeModule, SettingsModule],
  providers: [ProfitService],
  exports: [ProfitService],
})
export class ProfitModule {}
