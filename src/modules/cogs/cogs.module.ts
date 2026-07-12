import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CogsService } from './cogs.service';

@Module({
  imports: [PrismaModule],
  providers: [CogsService],
  exports: [CogsService],
})
export class CogsModule {}
