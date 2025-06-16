import { Module } from '@nestjs/common';
import { ManufacturerResolver } from './manufacturer.resolver';
import { ManufacturerService } from './manufacturer.service';

@Module({
  imports: [],
  providers: [ManufacturerService, ManufacturerResolver],
})
export class ManufacturerModule {}
