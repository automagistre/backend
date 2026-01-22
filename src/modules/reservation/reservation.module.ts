import { Module } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { ReservationResolver } from './reservation.resolver';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ReservationService, ReservationResolver],
  exports: [ReservationService],
})
export class ReservationModule {}
