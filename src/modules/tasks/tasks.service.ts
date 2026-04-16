import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthContext } from 'src/common/user-id.store';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { BackfillQualityControlTasksInput } from './inputs/backfill-quality-control-tasks.input';
import { CreateTaskInput } from './inputs/create-task.input';
import { UpdateTaskInput } from './inputs/update-task.input';
import { TaskBoardFilterInput } from './inputs/task-board-filter.input';
import {
  TaskResultEnum,
  TaskStatusEnum,
  TaskTypeEnum,
} from './enums/task.enums';
import { TaskModel } from './models/task.model';
import { TasksCountModel } from './models/tasks-count.model';

const TASK_INCLUDE = {
  order: true,
} satisfies Prisma.TaskInclude;

type TaskWithOrder = Prisma.TaskGetPayload<{
  include: typeof TASK_INCLUDE;
}>;

type CreateQualityControlTaskOnCloseInput = {
  orderId: string;
  orderNumber: number;
  customerId: string | null;
  orderTotalMinor: bigint;
};

type TaskOrderItemForTotal = {
  service?: {
    warranty: boolean;
    priceAmount: bigint | null;
    discountAmount: bigint | null;
  } | null;
  part?: {
    warranty: boolean;
    priceAmount: bigint | null;
    discountAmount: bigint | null;
    quantity: number;
  } | null;
};

const ORDER_STATUS_CLOSED = 10;
const BACKFILL_DEFAULT_DAYS = 30;
const BACKFILL_DEFAULT_LIMIT = 500;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  // ─── Board & Counts ───────────────────────────────────────────────

  async tasksBoard(
    ctx: AuthContext,
    filter?: TaskBoardFilterInput,
  ): Promise<TaskModel[]> {
    const where: Prisma.TaskWhereInput = {
      tenantId: ctx.tenantId,
    };

    if (filter?.type) {
      where.type = filter.type;
    }

    if (!(filter?.includeArchived ?? false)) {
      where.status = { not: TaskStatusEnum.ARCHIVED };
    }

    const tasks = await this.prisma.task.findMany({
      where,
      include: TASK_INCLUDE,
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
    });

    return tasks.map((task) => this.toTaskModel(task));
  }

  async tasksCount(
    ctx: AuthContext,
    type?: TaskTypeEnum,
  ): Promise<TasksCountModel> {
    const base: Prisma.TaskWhereInput = {
      tenantId: ctx.tenantId,
      ...(type ? { type } : {}),
    };

    const now = new Date();
    const overdueThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [pending, overdue, inProgress] = await Promise.all([
      this.prisma.task.count({
        where: {
          ...base,
          status: TaskStatusEnum.TODO,
          OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
        },
      }),
      this.prisma.task.count({
        where: {
          ...base,
          status: {
            in: [TaskStatusEnum.TODO, TaskStatusEnum.IN_PROGRESS],
          },
          scheduledAt: { lt: overdueThreshold },
        },
      }),
      this.prisma.task.count({
        where: {
          ...base,
          status: TaskStatusEnum.IN_PROGRESS,
        },
      }),
    ]);

    return { pending, overdue, inProgress };
  }

  // ─── CRUD ─────────────────────────────────────────────────────────

  async createTask(
    ctx: AuthContext,
    input: CreateTaskInput,
  ): Promise<TaskModel> {
    const tags = this.normalizeTags(input.tags);

    const task = await this.prisma.task.create({
      data: {
        tenantId: ctx.tenantId,
        type: input.type,
        status: TaskStatusEnum.TODO,
        title: input.title,
        description: input.description ?? null,
        orderId: input.orderId ?? null,
        customerId: input.customerId ?? null,
        scheduledAt: input.scheduledAt ?? null,
        tags,
        createdBy: ctx.userId,
      },
      include: TASK_INCLUDE,
    });

    return this.toTaskModel(task);
  }

  async updateTask(
    ctx: AuthContext,
    input: UpdateTaskInput,
  ): Promise<TaskModel> {
    const task = await this.getTaskById(ctx, input.id);
    const data: Prisma.TaskUpdateInput = {};

    if (input.status !== undefined) {
      this.validateStatusTransition(task.status as TaskStatusEnum, input.status, input);
      data.status = input.status;

      if (input.status === TaskStatusEnum.DONE) {
        data.completedAt = new Date();
        data.archivedAt = null;
      }
      if (input.status === TaskStatusEnum.ARCHIVED) {
        data.archivedAt = new Date();
      }
      if (input.status === TaskStatusEnum.IN_PROGRESS) {
        data.archivedAt = null;
        if (
          task.status === TaskStatusEnum.DONE ||
          task.status === TaskStatusEnum.ARCHIVED
        ) {
          data.scheduledAt = new Date();
        }
      }
    }

    if (input.result !== undefined) {
      data.result = input.result;
    }
    if (input.notes !== undefined) {
      data.notes = this.normalizeNotes(input.notes);
    }
    if (input.tags !== undefined) {
      data.tags = this.normalizeTags(input.tags);
    }
    if (input.requiresManagementAction !== undefined) {
      data.requiresManagementAction = input.requiresManagementAction;
    }
    if (input.assigneeUserId !== undefined) {
      data.assigneeUserId = input.assigneeUserId;
    }

    const updated = await this.prisma.task.update({
      where: { id: task.id },
      data,
      include: TASK_INCLUDE,
    });

    return this.toTaskModel(updated);
  }

  async deleteTask(ctx: AuthContext, id: string): Promise<boolean> {
    const task = await this.prisma.task.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!task) {
      throw new NotFoundException('Задача не найдена');
    }

    await this.prisma.task.delete({ where: { id: task.id } });
    return true;
  }

  // ─── Status Machine ───────────────────────────────────────────────

  private validateStatusTransition(
    current: TaskStatusEnum,
    target: TaskStatusEnum,
    input: UpdateTaskInput,
  ): void {
    const allowed: Record<TaskStatusEnum, TaskStatusEnum[]> = {
      [TaskStatusEnum.TODO]: [
        TaskStatusEnum.IN_PROGRESS,
        TaskStatusEnum.DONE,
      ],
      [TaskStatusEnum.IN_PROGRESS]: [TaskStatusEnum.DONE],
      [TaskStatusEnum.DONE]: [
        TaskStatusEnum.IN_PROGRESS,
        TaskStatusEnum.ARCHIVED,
      ],
      [TaskStatusEnum.ARCHIVED]: [TaskStatusEnum.IN_PROGRESS],
    };

    if (!allowed[current]?.includes(target)) {
      throw new BadRequestException(
        `Нельзя перевести задачу из "${current}" в "${target}"`,
      );
    }

    if (target === TaskStatusEnum.DONE && !input.result) {
      throw new BadRequestException(
        'Для завершения задачи необходимо указать результат',
      );
    }
  }

  // ─── QC Auto-creation ─────────────────────────────────────────────

  async createQualityControlTaskOnOrderClose(
    tx: Prisma.TransactionClient,
    ctx: AuthContext,
    input: CreateQualityControlTaskOnCloseInput,
  ): Promise<void> {
    if (input.orderTotalMinor <= 0n) {
      return;
    }

    const existing = await tx.task.findFirst({
      where: {
        tenantId: ctx.tenantId,
        orderId: input.orderId,
        type: TaskTypeEnum.QUALITY_CONTROL,
      },
      select: { id: true },
    });
    if (existing) {
      return;
    }

    const [delayDays, startHour, timezone] = await Promise.all([
      this.settingsService.getQualityControlDelayDays(ctx.tenantId, tx),
      this.settingsService.getQualityControlStartHour(ctx.tenantId, tx),
      this.settingsService.getTimezone(ctx.tenantId, tx),
    ]);
    const scheduledAt = this.scheduleAtBusinessDay(
      new Date(),
      delayDays,
      startHour,
      timezone,
    );
    const customerId = await this.resolveExistingCustomerId(
      input.customerId,
      tx,
    );

    await tx.task.create({
      data: {
        tenantId: ctx.tenantId,
        type: TaskTypeEnum.QUALITY_CONTROL,
        status: TaskStatusEnum.TODO,
        title: `Контроль по заказу №${input.orderNumber}`,
        description:
          'Позвонить клиенту и уточнить, всё ли в порядке после выдачи автомобиля.',
        orderId: input.orderId,
        customerId,
        scheduledAt,
        createdBy: ctx.userId,
        tags: [],
      },
    });
  }

  // ─── Backfill ─────────────────────────────────────────────────────

  async backfillQualityControlTasks(
    ctx: AuthContext,
    input?: BackfillQualityControlTasksInput,
  ): Promise<number> {
    const days = input?.days ?? BACKFILL_DEFAULT_DAYS;
    const limit = input?.limit ?? BACKFILL_DEFAULT_LIMIT;
    const since = this.addDays(new Date(), -days);

    const orders = await this.prisma.order.findMany({
      where: {
        tenantId: ctx.tenantId,
        status: ORDER_STATUS_CLOSED,
        close: {
          is: {
            orderDeal: {
              is: {
                createdAt: { gte: since },
              },
            },
          },
        },
      },
      select: {
        id: true,
        number: true,
        customerId: true,
        items: {
          select: {
            service: {
              select: {
                warranty: true,
                priceAmount: true,
                discountAmount: true,
              },
            },
            part: {
              select: {
                warranty: true,
                priceAmount: true,
                discountAmount: true,
                quantity: true,
              },
            },
          },
        },
        close: {
          select: {
            orderDeal: {
              select: {
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: { number: 'desc' },
      take: limit,
    });

    if (!orders.length) {
      return 0;
    }

    const existingTasks = await this.prisma.task.findMany({
      where: {
        tenantId: ctx.tenantId,
        type: TaskTypeEnum.QUALITY_CONTROL,
        orderId: { in: orders.map((order) => order.id) },
      },
      select: { orderId: true },
    });
    const existingOrderIds = new Set(
      existingTasks
        .map((task) => task.orderId)
        .filter((orderId): orderId is string => Boolean(orderId)),
    );

    const [delayDays, startHour, timezone] = await Promise.all([
      this.settingsService.getQualityControlDelayDays(ctx.tenantId),
      this.settingsService.getQualityControlStartHour(ctx.tenantId),
      this.settingsService.getTimezone(ctx.tenantId),
    ]);
    const existingCustomerIds = await this.getExistingCustomerIds(
      orders.map((order) => order.customerId),
    );

    let createdCount = 0;
    for (const order of orders) {
      if (existingOrderIds.has(order.id)) {
        continue;
      }

      const orderTotalMinor = this.calculateOrderTotalFromItems(order.items);
      if (orderTotalMinor <= 0n) {
        continue;
      }

      const customerId =
        order.customerId && existingCustomerIds.has(order.customerId)
          ? order.customerId
          : null;
      const closedAt = order.close?.orderDeal?.createdAt ?? new Date();
      const scheduledAt = this.scheduleAtBusinessDay(
        closedAt,
        delayDays,
        startHour,
        timezone,
      );

      await this.prisma.task.create({
        data: {
          tenantId: ctx.tenantId,
          type: TaskTypeEnum.QUALITY_CONTROL,
          status: TaskStatusEnum.TODO,
          title: `Контроль по заказу №${order.number}`,
          description:
            'Позвонить клиенту и уточнить, всё ли в порядке после выдачи автомобиля.',
          orderId: order.id,
          customerId,
          scheduledAt,
          createdBy: ctx.userId,
          tags: [],
        },
      });
      createdCount += 1;
    }

    return createdCount;
  }

  // ─── Auto-archive (cron) ──────────────────────────────────────────

  async archiveSuccessfulQualityControlTasksForTenant(
    ctx: AuthContext,
  ): Promise<number> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const result = await this.prisma.task.updateMany({
      where: {
        tenantId: ctx.tenantId,
        type: TaskTypeEnum.QUALITY_CONTROL,
        status: TaskStatusEnum.DONE,
        result: TaskResultEnum.ALL_GOOD,
        requiresManagementAction: false,
        completedAt: { lt: startOfToday },
      },
      data: {
        status: TaskStatusEnum.ARCHIVED,
        archivedAt: new Date(),
      },
    });

    return result.count;
  }

  // ─── Private helpers ──────────────────────────────────────────────

  private async getTaskById(
    ctx: AuthContext,
    taskId: string,
  ): Promise<TaskWithOrder> {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        tenantId: ctx.tenantId,
      },
      include: TASK_INCLUDE,
    });
    if (!task) {
      throw new NotFoundException('Задача не найдена');
    }
    return task;
  }

  private normalizeTags(tags: string[] | null | undefined): string[] {
    if (!tags?.length) return [];
    return Array.from(
      new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)),
    );
  }

  private normalizeNotes(notes: string | null | undefined): string | null {
    const normalized = notes?.trim();
    return normalized ? normalized : null;
  }

  private scheduleAtBusinessDay(
    date: Date,
    days: number,
    startHour: number,
    timezone: string,
  ): Date {
    const normalizedDays = Number.isFinite(days) ? Math.trunc(days) : 0;

    const localDateStr = date.toLocaleDateString('en-CA', {
      timeZone: timezone,
    });
    const [y, m, d] = localDateStr.split('-').map(Number);

    const naive = new Date(
      Date.UTC(y, m - 1, d + normalizedDays, startHour),
    );

    const utcStr = naive.toLocaleString('en-US', { timeZone: 'UTC' });
    const tzStr = naive.toLocaleString('en-US', { timeZone: timezone });
    const offsetMs =
      new Date(tzStr).getTime() - new Date(utcStr).getTime();

    return new Date(naive.getTime() - offsetMs);
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    const normalizedDays = Number.isFinite(days) ? Math.trunc(days) : 0;
    result.setDate(result.getDate() + normalizedDays);
    return result;
  }

  private calculateOrderTotalFromItems(items: TaskOrderItemForTotal[]): bigint {
    let total = 0n;

    for (const item of items) {
      if (item.service) {
        if (item.service.warranty) continue;
        const price = item.service.priceAmount ?? 0n;
        const discount = item.service.discountAmount ?? 0n;
        total += price - discount;
      }

      if (item.part) {
        if (item.part.warranty) continue;
        const price = item.part.priceAmount ?? 0n;
        const discount = item.part.discountAmount ?? 0n;
        total += ((price - discount) * BigInt(item.part.quantity)) / 100n;
      }
    }

    return total;
  }

  private toTaskModel(task: TaskWithOrder): TaskModel {
    return {
      id: task.id,
      type: task.type,
      status: task.status,
      title: task.title,
      description: task.description ?? null,
      orderId: task.orderId ?? null,
      order: task.order ?? null,
      customerId: task.customerId ?? null,
      assigneeUserId: task.assigneeUserId ?? null,
      scheduledAt: task.scheduledAt ?? null,
      completedAt: task.completedAt ?? null,
      archivedAt: task.archivedAt ?? null,
      result: task.result ?? null,
      requiresManagementAction: task.requiresManagementAction,
      notes: task.notes ?? null,
      tags: task.tags ?? [],
      createdAt: task.createdAt ?? null,
      updatedAt: task.updatedAt ?? null,
    };
  }

  private async resolveExistingCustomerId(
    customerId: string | null | undefined,
    tx?: Prisma.TransactionClient,
  ): Promise<string | null> {
    if (!customerId) {
      return null;
    }
    const client = tx ?? this.prisma;
    const customer = await client.person.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    return customer?.id ?? null;
  }

  private async getExistingCustomerIds(
    customerIds: Array<string | null | undefined>,
  ): Promise<Set<string>> {
    const uniqueCustomerIds = Array.from(
      new Set(customerIds.filter((id): id is string => Boolean(id))),
    );
    if (!uniqueCustomerIds.length) {
      return new Set<string>();
    }
    const customers = await this.prisma.person.findMany({
      where: { id: { in: uniqueCustomerIds } },
      select: { id: true },
    });
    return new Set(customers.map((customer) => customer.id));
  }
}
