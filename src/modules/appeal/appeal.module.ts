import { Module } from '@nestjs/common';
import { AppealService } from './appeal.service';
import { AppealResolver } from './appeal.resolver';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [PrismaModule, CommonModule],
  providers: [AppealService, AppealResolver],
  exports: [AppealService],
})
export class AppealModule {}
