import { Module } from '@nestjs/common';
import { CommonModule } from 'src/common/common.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CallsResolver } from './calls.resolver';
import { CallsService } from './calls.service';
import { UisCallsModule } from './providers/uis/uis-calls.module';

@Module({
  imports: [PrismaModule, CommonModule, UisCallsModule],
  providers: [CallsService, CallsResolver],
  exports: [CallsService],
})
export class CallsModule {}
