import { Module } from '@nestjs/common';
import { DisplayContextService } from './display-context.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [DisplayContextService],
  exports: [DisplayContextService],
})
export class DisplayContextModule {}
