import { Global, Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SettingsResolver } from './settings.resolver';
import { SettingsService } from './settings.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [SettingsService, SettingsResolver],
  exports: [SettingsService],
})
export class SettingsModule {}
