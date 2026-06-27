import { Module } from '@nestjs/common';
import { NoteService } from './note.service';
import { NoteResolver } from './note.resolver';
import { DisplayContextModule } from '../display-context/display-context.module';

@Module({
  imports: [DisplayContextModule],
  providers: [NoteService, NoteResolver],
  exports: [NoteService],
})
export class NoteModule {}
