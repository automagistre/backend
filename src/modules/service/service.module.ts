import { Module } from '@nestjs/common';
import { ServiceResolver } from './service.resolver';
import { ServiceService } from './service.service';
import { DisplayContextModule } from '../display-context/display-context.module';

@Module({
  imports: [DisplayContextModule],
  providers: [ServiceService, ServiceResolver],
  exports: [ServiceService],
})
export class ServiceModule {}
