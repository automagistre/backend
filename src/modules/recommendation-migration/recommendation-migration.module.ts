import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { OrderModule } from 'src/modules/order/order.module';
import { EmployeeModule } from 'src/modules/employee/employee.module';
import { RecommendationModule } from 'src/modules/recommendation/recommendation.module';
import { RecommendationWorkMigrationService } from './recommendation-work-migration.service';
import { RecommendationMigrationResolver } from 'src/modules/recommendation-migration/recommendation-migration.resolver';

@Module({
  imports: [PrismaModule, OrderModule, EmployeeModule, RecommendationModule],
  providers: [RecommendationWorkMigrationService, RecommendationMigrationResolver],
  exports: [RecommendationWorkMigrationService],
})
export class RecommendationMigrationModule {}
