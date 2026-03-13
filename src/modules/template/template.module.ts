import { Module } from '@nestjs/common';
import { TemplateService } from './template.service';
import { TemplateResolver } from './template.resolver';
import { McModule } from '../mc/mc.module';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [McModule, OrderModule],
  providers: [TemplateService, TemplateResolver],
  exports: [TemplateService],
})
export class TemplateModule {}
