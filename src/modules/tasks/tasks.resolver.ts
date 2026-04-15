import {
  Args,
  ID,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';
import { PrismaService } from 'src/prisma/prisma.service';
import { PersonModel } from '../person/models/person.model';
import { BackfillQualityControlTasksInput } from './inputs/backfill-quality-control-tasks.input';
import { CreateTaskInput } from './inputs/create-task.input';
import { UpdateTaskInput } from './inputs/update-task.input';
import { TaskBoardFilterInput } from './inputs/task-board-filter.input';
import { TaskTypeEnum } from './enums/task.enums';
import { TaskModel } from './models/task.model';
import { TasksCountModel } from './models/tasks-count.model';
import { TasksService } from './tasks.service';

@Resolver(() => TaskModel)
@RequireTenant()
export class TasksResolver {
  constructor(
    private readonly tasksService: TasksService,
    private readonly prisma: PrismaService,
  ) {}

  @Query(() => [TaskModel], {
    description: 'Список задач для канбан-доски',
  })
  async tasksBoard(
    @AuthContext() ctx: AuthContextType,
    @Args('filter', { type: () => TaskBoardFilterInput, nullable: true })
    filter?: TaskBoardFilterInput,
  ): Promise<TaskModel[]> {
    return this.tasksService.tasksBoard(ctx, filter);
  }

  @Query(() => TasksCountModel, {
    description: 'Счётчики задач для бейджей',
  })
  async tasksCount(
    @AuthContext() ctx: AuthContextType,
    @Args('type', { type: () => TaskTypeEnum, nullable: true })
    type?: TaskTypeEnum,
  ): Promise<TasksCountModel> {
    return this.tasksService.tasksCount(ctx, type);
  }

  @Mutation(() => TaskModel, { description: 'Создать задачу' })
  async createTask(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: CreateTaskInput,
  ): Promise<TaskModel> {
    return this.tasksService.createTask(ctx, input);
  }

  @Mutation(() => TaskModel, {
    description: 'Обновить задачу (статус, результат, теги и др.)',
  })
  async updateTask(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: UpdateTaskInput,
  ): Promise<TaskModel> {
    return this.tasksService.updateTask(ctx, input);
  }

  @Mutation(() => Boolean, { description: 'Удалить задачу' })
  async deleteTask(
    @AuthContext() ctx: AuthContextType,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.tasksService.deleteTask(ctx, id);
  }

  @Mutation(() => Int, {
    description:
      'Создать пропущенные задачи контроля качества для недавно закрытых заказов',
  })
  async backfillQualityControlTasks(
    @AuthContext() ctx: AuthContextType,
    @Args('input', {
      type: () => BackfillQualityControlTasksInput,
      nullable: true,
    })
    input?: BackfillQualityControlTasksInput,
  ): Promise<number> {
    return this.tasksService.backfillQualityControlTasks(ctx, input);
  }

  @ResolveField('customer', () => PersonModel, { nullable: true })
  async resolveCustomer(
    @Parent() task: TaskModel,
  ): Promise<PersonModel | null> {
    if (!task.customerId) return null;
    const person = await this.prisma.person.findUnique({
      where: { id: task.customerId },
    });
    return person as PersonModel | null;
  }
}
