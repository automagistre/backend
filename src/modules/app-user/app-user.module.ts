import { Global, Module } from '@nestjs/common';
import { AppUserService } from './app-user.service';
import { AppUserLoader } from './app-user.loader';

@Global()
@Module({
  providers: [AppUserService, AppUserLoader],
  exports: [AppUserService, AppUserLoader],
})
export class AppUserModule {}
