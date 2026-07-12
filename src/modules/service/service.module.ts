import { Module, forwardRef } from '@nestjs/common';
import { ServiceResolver } from './service.resolver';
import { ServiceService } from './service.service';
import { DisplayContextModule } from '../display-context/display-context.module';
import { RecommendationModule } from '../recommendation/recommendation.module';

@Module({
  imports: [DisplayContextModule, forwardRef(() => RecommendationModule)],
  providers: [ServiceService, ServiceResolver],
  exports: [ServiceService],
})
export class ServiceModule {}
