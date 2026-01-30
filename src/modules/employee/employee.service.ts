import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateEmployeeInput,
  UpdateEmployeeInput,
} from './inputs/employee.input';
import { TenantService } from 'src/common/services/tenant.service';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

@Injectable()
export class EmployeeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
  ) {}

  async create(data: CreateEmployeeInput) {
    return this.prisma.employee.create({
      data: {
        ...data,
        hiredAt: data.hiredAt || new Date(),
      },
      include: {
        person: true,
      },
    });
  }

  async update({ id, ...data }: UpdateEmployeeInput) {
    // Фильтруем null значения для Prisma
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

  async findMany({
    take = DEFAULT_TAKE,
    skip = DEFAULT_SKIP,
    search,
    includeFired = false,
  }: {
    take?: number;
    skip?: number;
    search?: string;
    includeFired?: boolean;
  }) {
    const tenantId = await this.tenantService.getTenantId();

    const where: any = {
      tenantId,
      ...(includeFired ? {} : { firedAt: null }),
      ...(search
        ? {
            person: {
              OR: [
                {
                  firstname: { contains: search, mode: 'insensitive' as const },
                },
                {
                  lastname: { contains: search, mode: 'insensitive' as const },
                },
                {
                  telephone: { contains: search, mode: 'insensitive' as const },
                },
              ],
            },
          }
        : {}),
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

  async findOne(id: string) {
    const tenantId = await this.tenantService.getTenantId();
    return this.prisma.employee.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        person: true,
      },
    });
  }

  async findByPersonId(personId: string) {
    const tenantId = await this.tenantService.getTenantId();
    return this.prisma.employee.findFirst({
      where: {
        personId,
        tenantId,
      },
      include: {
        person: true,
      },
    });
  }

  async resolvePersonIdByEmployeeId(employeeId: string | null): Promise<string | null> {
    if (!employeeId) return null;
    const employee = await this.findOne(employeeId);
    return employee?.personId ?? null;
  }

  async resolveEmployeeIdByPersonId(personId: string | null): Promise<string | null> {
    if (!personId) return null;
    const employee = await this.findByPersonId(personId);
    return employee?.id ?? null;
  }

  async resolveEmployeeByWorkerId(workerId: string) {
    const byPerson = await this.findByPersonId(workerId);
    if (byPerson) return byPerson;
    return this.findOne(workerId);
  }

  async resolvePersonIdByWorkerId(workerId: string | null): Promise<string | null> {
    if (!workerId) return null;
    const byPerson = await this.findByPersonId(workerId);
    if (byPerson) return byPerson.personId;
    return this.resolvePersonIdByEmployeeId(workerId);
  }

  async fire(id: string) {
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

  async remove(id: string) {
    return this.prisma.employee.delete({
      where: { id },
    });
  }
}
