import { Module } from '@nestjs/common';
import { CustomerCarRelationService } from './customer-car-relation.service';

@Module({
  providers: [CustomerCarRelationService],
  exports: [CustomerCarRelationService],
})
export class CustomerCarRelationModule {}
