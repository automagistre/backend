import { Module } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { CustomerModule } from 'src/modules/customer/customer.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UisCallsController } from './uis-calls.controller';
import { UisCallsPollingService } from './uis-calls-polling.service';
import { UisCallsRecordingsService } from './uis-calls-recordings.service';
import { UisCallsWebhookService } from './uis-calls-webhook.service';

@Module({
  imports: [PrismaModule, CustomerModule],
  controllers: [UisCallsController],
  providers: [
    {
      provide: 'CALLS_PUB_SUB',
      useValue: new PubSub(),
    },
    UisCallsWebhookService,
    UisCallsPollingService,
    UisCallsRecordingsService,
  ],
  exports: ['CALLS_PUB_SUB'],
})
export class UisCallsModule {}
