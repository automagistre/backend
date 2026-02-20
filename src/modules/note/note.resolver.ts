import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';
import { NoteService } from './note.service';
import { NoteModel } from './models/note.model';
import { CreateNoteInput } from './inputs/create-note.input';
import { UpdateNoteInput } from './inputs/update-note.input';

@Resolver(() => NoteModel)
@RequireTenant()
export class NoteResolver {
  constructor(private readonly noteService: NoteService) {}

  @Query(() => [NoteModel], {
    name: 'notes',
    description: 'Заметки по subject (Order, Car или Person)',
  })
  async notes(
    @Args('subjectId', { type: () => ID }) subjectId: string,
    @AuthContext() ctx: AuthContextType,
  ) {
    return this.noteService.findBySubject(ctx, subjectId);
  }

  @Mutation(() => NoteModel, { name: 'createNote' })
  async createNote(
    @Args('input') input: CreateNoteInput,
    @AuthContext() ctx: AuthContextType,
  ) {
    return this.noteService.create(ctx, input);
  }

  @Mutation(() => NoteModel, { name: 'updateNote' })
  async updateNote(
    @Args('input') input: UpdateNoteInput,
    @AuthContext() ctx: AuthContextType,
  ) {
    return this.noteService.update(ctx, input);
  }

  @Mutation(() => NoteModel, { name: 'deleteNote' })
  async deleteNote(
    @Args('id', { type: () => ID }) id: string,
    @Args('description', { type: () => String, nullable: true }) description: string | undefined,
    @AuthContext() ctx: AuthContextType,
  ) {
    return this.noteService.softDelete(ctx, id, description);
  }
}
