import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePersonInput } from './inputs/create.input';
import { UpdatePersonInput } from './inputs/update.input';
import { Person } from 'src/generated/prisma/client';
import type { AuthContext } from 'src/common/user-id.store';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

@Injectable()
export class PersonService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    ctx: AuthContext,
    createPersonInput: CreatePersonInput,
  ): Promise<Person> {
    return this.prisma.person.create({
      data: {
        ...createPersonInput,
        tenantGroupId: ctx.tenantGroupId,
        createdBy: ctx.userId,
      },
    });
  }

  async findMany(
    ctx: AuthContext,
    {
      take = DEFAULT_TAKE,
      skip = DEFAULT_SKIP,
      search,
    }: {
      take: number;
      skip: number;
      search?: string;
    },
  ) {
    const baseWhere = { tenantGroupId: ctx.tenantGroupId };

    let where: Record<string, unknown> = baseWhere;

    if (search) {
      const searchTerms = search
        .trim()
        .split(/\s+/)
        .filter((term) => term.length > 0);

      const andConditions = searchTerms.map((term) => ({
        OR: [
          { firstname: { contains: term, mode: 'insensitive' as const } },
          { lastname: { contains: term, mode: 'insensitive' as const } },
          { telephone: { contains: term, mode: 'insensitive' as const } },
          { officePhone: { contains: term, mode: 'insensitive' as const } },
          { email: { contains: term, mode: 'insensitive' as const } },
        ],
      }));

      where = { ...baseWhere, AND: andConditions };
    }

    const [items, total] = await Promise.all([
      this.prisma.person.findMany({
        where,
        take: +take,
        skip: +skip,
        orderBy: [{ id: 'desc' }],
      }),
      this.prisma.person.count({ where }),
    ]);

    return {
      items,
      total,
    };
  }

  async findOne(ctx: AuthContext, id: string): Promise<Person | null> {
    return this.prisma.person.findFirst({
      where: { id, tenantGroupId: ctx.tenantGroupId },
    });
  }

  async getNamesByIds(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();

    const persons = await this.prisma.person.findMany({
      where: { id: { in: ids } },
      select: { id: true, firstname: true, lastname: true },
    });

    return new Map(
      persons.map((p) => [
        p.id,
        [p.lastname, p.firstname].filter(Boolean).join(' ') || 'Без имени',
      ]),
    );
  }

  async update(
    ctx: AuthContext,
    updatePersonInput: UpdatePersonInput,
  ): Promise<Person> {
    const { id, ...data } = updatePersonInput;

    const existing = await this.prisma.person.findFirst({
      where: { id, tenantGroupId: ctx.tenantGroupId },
    });
    if (!existing) {
      throw new NotFoundException(`Клиент не найден или недоступен`);
    }

    return this.prisma.person.update({
      where: { id },
      data,
    });
  }

  // TODO: После применения миграции с onDelete: Restrict можно убрать ручные проверки
  // и полагаться на constraint БД (Employee, CalendarEntryOrderInfo).
  // Order.customerId и Income.supplierId — полиморфные связи, бизнес-логика требует блокировки.
  async delete(ctx: AuthContext, id: string): Promise<Person> {
    const existing = await this.prisma.person.findFirst({
      where: { id, tenantGroupId: ctx.tenantGroupId },
    });
    if (!existing) {
      throw new NotFoundException(`Клиент не найден или недоступен`);
    }

    const [
      employeeCount,
      calendarCustomerCount,
      calendarWorkerCount,
      orderCount,
      incomeCount,
    ] = await Promise.all([
      this.prisma.employee.count({ where: { personId: id } }),
      this.prisma.calendarEntryOrderInfo.count({ where: { customerId: id } }),
      this.prisma.calendarEntryOrderInfo.count({ where: { workerId: id } }),
      this.prisma.order.count({ where: { customerId: id } }),
      this.prisma.income.count({ where: { supplierId: id } }),
    ]);

    if (employeeCount > 0) {
      throw new ConflictException(
        `Нельзя удалить: клиент является сотрудником (${employeeCount} записей)`,
      );
    }

    if (calendarCustomerCount > 0 || calendarWorkerCount > 0) {
      const total = calendarCustomerCount + calendarWorkerCount;
      throw new ConflictException(
        `Нельзя удалить: есть ${total} записей в календаре`,
      );
    }

    if (orderCount > 0) {
      throw new ConflictException(
        `Нельзя удалить: есть ${orderCount} связанных заказов`,
      );
    }

    if (incomeCount > 0) {
      throw new ConflictException(
        `Нельзя удалить: клиент является поставщиком в ${incomeCount} приходах`,
      );
    }

    return this.prisma.person.delete({
      where: { id },
    });
  }
}
