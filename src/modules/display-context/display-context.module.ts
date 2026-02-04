import { Module } from '@nestjs/common';
import { DisplayContextService } from './display-context.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [PrismaModule, CommonModule],
  providers: [DisplayContextService],
  exports: [DisplayContextService],
})
export class DisplayContextModule {}
