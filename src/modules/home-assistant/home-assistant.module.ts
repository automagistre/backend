import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HomeAssistantService } from './home-assistant.service';

@Module({
  imports: [ConfigModule],
  providers: [HomeAssistantService],
  exports: [HomeAssistantService],
})
export class HomeAssistantModule {} 
