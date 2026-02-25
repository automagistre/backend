import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateEmployeeInput,
  UpdateEmployeeInput,
} from './inputs/employee.input';
import type { AuthContext } from 'src/common/user-id.store';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

@Injectable()
export class EmployeeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ctx: AuthContext, data: CreateEmployeeInput) {
    return this.prisma.employee.create({
      data: {
        ...data,
        hiredAt: data.hiredAt || new Date(),
        tenantId: ctx.tenantId,
        createdBy: ctx.userId,
      },
      include: {
        person: true,
      },
    });
  }

  async update(ctx: AuthContext, { id, ...data }: UpdateEmployeeInput) {
    const existing = await this.prisma.employee.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Сотрудник не найден или недоступен');
    }

    const updateData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== null),
    );

    return this.prisma.employee.update({
      where: { id },
      data: updateData,
      include: {
        person: true,
      },
    });
  }

  async findMany(
    ctx: AuthContext,
    {
      take = DEFAULT_TAKE,
      skip = DEFAULT_SKIP,
      search,
      includeFired = false,
    }: {
      take?: number;
      skip?: number;
      search?: string;
      includeFired?: boolean;
    },
  ) {
    const personFilter = {
      tenantGroupId: ctx.tenantGroupId,
      ...(search
        ? {
            OR: [
              { firstname: { contains: search, mode: 'insensitive' as const } },
              { lastname: { contains: search, mode: 'insensitive' as const } },
              { telephone: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const where: any = {
      tenantId: ctx.tenantId,
      ...(includeFired ? {} : { firedAt: null }),
      person: personFilter,
    };

    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        take: +take,
        skip: +skip,
        include: {
          person: true,
        },
        orderBy: {
          person: {
            lastname: 'asc',
          },
        },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(ctx: AuthContext, id: string) {
    return this.prisma.employee.findFirst({
      where: {
        id,
        tenantId: ctx.tenantId,
        person: { tenantGroupId: ctx.tenantGroupId },
      },
      include: {
        person: true,
      },
    });
  }

  async findByPersonId(ctx: AuthContext, personId: string) {
    return this.prisma.employee.findFirst({
      where: {
        personId,
        tenantId: ctx.tenantId,
        person: { tenantGroupId: ctx.tenantGroupId },
      },
      include: {
        person: true,
      },
    });
  }

  async resolvePersonIdByEmployeeId(
    ctx: AuthContext,
    employeeId: string | null,
  ): Promise<string | null> {
    if (!employeeId) return null;
    const employee = await this.findOne(ctx, employeeId);
    return employee?.personId ?? null;
  }

  async resolveEmployeeIdByPersonId(
    ctx: AuthContext,
    personId: string | null,
  ): Promise<string | null> {
    if (!personId) return null;
    const employee = await this.findByPersonId(ctx, personId);
    return employee?.id ?? null;
  }

  async resolveEmployeeByWorkerId(ctx: AuthContext, workerId: string) {
    const byPerson = await this.findByPersonId(ctx, workerId);
    if (byPerson) return byPerson;
    return this.findOne(ctx, workerId);
  }

  async resolvePersonIdByWorkerId(
    ctx: AuthContext,
    workerId: string | null,
  ): Promise<string | null> {
    if (!workerId) return null;
    const byPerson = await this.findByPersonId(ctx, workerId);
    if (byPerson) return byPerson.personId;
    return this.resolvePersonIdByEmployeeId(ctx, workerId);
  }

  async fire(ctx: AuthContext, id: string) {
    const existing = await this.prisma.employee.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Сотрудник не найден или недоступен');
    }

    return this.prisma.employee.update({
      where: { id },
      data: {
        firedAt: new Date(),
      },
      include: {
        person: true,
      },
    });
  }

  async remove(ctx: AuthContext, id: string) {
    const existing = await this.prisma.employee.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Сотрудник не найден или недоступен');
    }

    const [orderCount, salaryCount] = await Promise.all([
      this.prisma.order.count({ where: { workerId: id } }),
      this.prisma.employeeSalary.count({ where: { employeeId: id } }),
    ]);

    if (orderCount > 0) {
      throw new ConflictException(
        `Нельзя удалить: есть ${orderCount} связанных заказов`,
      );
    }

    if (salaryCount > 0) {
      throw new ConflictException(
        `Нельзя удалить: есть ${salaryCount} записей о зарплате`,
      );
    }

    return this.prisma.employee.delete({
      where: { id },
    });
  }
}
