import { Global, Module } from '@nestjs/common';
import { TenantService } from './services/tenant.service';
import { TenantGuard } from './guards/tenant.guard';

@Global()
@Module({
  providers: [TenantService, TenantGuard],
  exports: [TenantService],
})
export class CommonModule {}
