import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { NoteService } from './note.service';
import { NoteModel } from './models/note.model';
import { CreateNoteInput } from './inputs/create-note.input';
import { UpdateNoteInput } from './inputs/update-note.input';

@Resolver(() => NoteModel)
export class NoteResolver {
  constructor(private readonly noteService: NoteService) {}

  @Query(() => [NoteModel], {
    name: 'notes',
    description: 'Заметки по subject (Order, Car или Person)',
  })
  async notes(@Args('subjectId', { type: () => ID }) subjectId: string) {
    return this.noteService.findBySubject(subjectId);
  }

  @Mutation(() => NoteModel, { name: 'createNote' })
  async createNote(
    @Args('input') input: CreateNoteInput,
    @CurrentUser({ required: true }) user: { sub: string },
  ) {
    return this.noteService.create(input, user.sub);
  }

  @Mutation(() => NoteModel, { name: 'updateNote' })
  async updateNote(@Args('input') input: UpdateNoteInput) {
    return this.noteService.update(input);
  }

  @Mutation(() => NoteModel, { name: 'deleteNote' })
  async deleteNote(
    @Args('id', { type: () => ID }) id: string,
    @Args('description', { nullable: true }) description?: string,
    @CurrentUser({ required: true }) user?: { sub: string },
  ) {
    return this.noteService.softDelete(id, user!.sub, description);
  }
}
