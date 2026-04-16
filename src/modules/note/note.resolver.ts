import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';
import { NoteService } from './note.service';
import { NoteModel } from './models/note.model';
import { CreateNoteInput } from './inputs/create-note.input';
import { UpdateNoteInput } from './inputs/update-note.input';
import { AppUserModel } from 'src/modules/app-user/models/app-user.model';
import { AppUserLoader } from 'src/modules/app-user/app-user.loader';

@Resolver(() => NoteModel)
@RequireTenant()
export class NoteResolver {
  constructor(
    private readonly noteService: NoteService,
    private readonly appUserLoader: AppUserLoader,
  ) {}

  @Query(() => [NoteModel], {
    name: 'notes',
    description: 'Заметки по subject (Order, Car или Person)',
  })
  async notes(
    @Args('subjectId', { type: () => ID }) subjectId: string,
    @Args('isPublic', { type: () => Boolean, nullable: true })
    isPublic: boolean | null | undefined,
    @AuthContext() ctx: AuthContextType,
  ) {
    return this.noteService.findBySubject(ctx, subjectId, isPublic);
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
    @Args('description', { type: () => String, nullable: true })
    description: string | undefined,
    @AuthContext() ctx: AuthContextType,
  ) {
    return this.noteService.softDelete(ctx, id, description);
  }

  @ResolveField(() => AppUserModel, { nullable: true })
  async createdByUser(@Parent() note: NoteModel) {
    if (!note.createdBy) return null;
    return this.appUserLoader.load(note.createdBy);
  }
}
