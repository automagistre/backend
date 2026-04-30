import { Module } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { CommonModule } from 'src/common/common.module';
import { CustomerModule } from 'src/modules/customer/customer.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UisCallsController } from './uis-calls.controller';
import { UisCallsPollingService } from './uis-calls-polling.service';
import { UisCallsRecordingsService } from './uis-calls-recordings.service';
import { UisCallsWebhookService } from './uis-calls-webhook.service';
import { UisInteractiveController } from './uis-interactive.controller';
import { UisInteractiveService } from './uis-interactive.service';

@Module({
  imports: [PrismaModule, CommonModule, CustomerModule],
  controllers: [UisCallsController, UisInteractiveController],
  providers: [
    {
      provide: 'CALLS_PUB_SUB',
      useValue: new PubSub(),
    },
    UisCallsWebhookService,
    UisCallsPollingService,
    UisCallsRecordingsService,
    UisInteractiveService,
  ],
  exports: ['CALLS_PUB_SUB'],
})
export class UisCallsModule {}
