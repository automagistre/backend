import { Module } from '@nestjs/common';
import { CommonModule } from 'src/common/common.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CallRoutingBindingsService } from './call-routing-bindings.service';
import { CallsRetentionService } from './calls-retention.service';
import { CallsRecordingsController } from './calls-recordings.controller';
import { CallsResolver, CallsSubscriptionResolver } from './calls.resolver';
import { CallsService } from './calls.service';
import { UisCallsModule } from './providers/uis/uis-calls.module';

@Module({
  imports: [PrismaModule, CommonModule, UisCallsModule],
  controllers: [CallsRecordingsController],
  providers: [
    CallsService,
    CallRoutingBindingsService,
    CallsRetentionService,
    CallsResolver,
    CallsSubscriptionResolver,
  ],
  exports: [CallsService],
})
export class CallsModule {}
