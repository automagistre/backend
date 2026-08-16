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
import { SettingsService } from 'src/modules/settings/settings.service';
import { applyDefaultCurrency } from 'src/common/money';
import type { MoneyInput } from 'src/common/inputs/money.input';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

@Injectable()
export class EmployeeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  private async resolveGuaranteedMinimum(
    value: MoneyInput | null | undefined,
  ): Promise<bigint | null | undefined> {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    const money = applyDefaultCurrency(value, defaultCurrency);
    return money.amountMinor > 0n ? money.amountMinor : null;
  }

  async create(ctx: AuthContext, data: CreateEmployeeInput) {
    const guaranteedMinimumAmount = await this.resolveGuaranteedMinimum(
      data.guaranteedMinimumAmount,
    );

    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          personId: data.personId,
          ratio: data.ratio,
          hiredAt: data.hiredAt || new Date(),
          ...(guaranteedMinimumAmount !== undefined
            ? { guaranteedMinimumAmount }
            : {}),
          tenantId: ctx.tenantId,
          createdBy: ctx.userId,
        },
      });
      await tx.person.update({
        where: { id: data.personId },
        data: { contractor: true },
      });
      return tx.employee.findUniqueOrThrow({
        where: { id: employee.id },
        include: { person: true },
      });
    });
  }

  async update(ctx: AuthContext, { id, ...data }: UpdateEmployeeInput) {
    const existing = await this.prisma.employee.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Сотрудник не найден или недоступен');
    }

    const { guaranteedMinimumAmount: guaranteeInput, ...rest } = data;
    const updateData: Record<string, unknown> = Object.fromEntries(
      Object.entries(rest).filter(([_, value]) => value !== null),
    );

    if (guaranteeInput !== undefined) {
      updateData.guaranteedMinimumAmount =
        await this.resolveGuaranteedMinimum(guaranteeInput);
    }

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
      orderBy: { firedAt: { sort: 'asc', nulls: 'first' } },
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

  async fire(ctx: AuthContext, id: string) {
    const existing = await this.prisma.employee.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Сотрудник не найден или недоступен');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: { firedAt: new Date() },
      });
      await tx.person.update({
        where: { id: existing.personId },
        data: { contractor: false },
      });
      return tx.employee.findUniqueOrThrow({
        where: { id },
        include: { person: true },
      });
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
      this.prisma.order.count({ where: { assigneeId: existing.personId } }),
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
