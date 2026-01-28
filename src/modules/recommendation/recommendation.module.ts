import { Module } from '@nestjs/common';
import { RecommendationResolver } from './recommendation.resolver';
import { RecommendationService } from './recommendation.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EmployeeModule } from 'src/modules/employee/employee.module';
import { CarModule } from 'src/modules/vehicle/car.module';
import { CommonModule } from 'src/common/common.module';
import { ReservationModule } from 'src/modules/reservation/reservation.module';

@Module({
  imports: [PrismaModule, CommonModule, EmployeeModule, CarModule, ReservationModule],
  providers: [RecommendationService, RecommendationResolver],
  exports: [RecommendationService],
})
export class RecommendationModule {}

