import { Global, Module } from '@nestjs/common';
import { TenantService } from './services/tenant.service';
import { TenantGuard } from './guards/tenant.guard';
import { BigIntScalar } from './scalars/bigint.scalar';

@Global()
@Module({
  providers: [TenantService, TenantGuard, BigIntScalar],
  exports: [TenantService, BigIntScalar],
})
export class CommonModule {}
