import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UisCallsController } from './uis-calls.controller';
import { UisCallsWebhookService } from './uis-calls-webhook.service';

@Module({
  imports: [PrismaModule],
  controllers: [UisCallsController],
  providers: [UisCallsWebhookService],
})
export class UisCallsModule {}
