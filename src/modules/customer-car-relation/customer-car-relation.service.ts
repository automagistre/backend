import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthContext } from 'src/common/user-id.store';

@Injectable()
export class CustomerCarRelationService {
  constructor(private readonly prisma: PrismaService) {}

  async findCarsByCustomerId(
    ctx: AuthContext,
    customerId: string,
    options?: {
      search?: string;
      take?: number;
    },
  ) {
    const links = await this.prisma.order.findMany({
      where: {
        tenantId: ctx.tenantId,
        customerId,
        carId: { not: null },
      },
      select: { carId: true },
      distinct: ['carId'],
      orderBy: { id: 'desc' },
    });

    const allCarIds = links
      .map((item) => item.carId)
      .filter((carId): carId is string => Boolean(carId));

    if (allCarIds.length === 0) {
      return [];
    }

    const search = options?.search?.trim();
    const rows = await this.prisma.car.findMany({
      where: {
        tenantGroupId: ctx.tenantGroupId,
        id: { in: allCarIds },
        ...(search
          ? {
              OR: [
                { identifier: { contains: search, mode: 'insensitive' as const } },
                { gosnomer: { contains: search, mode: 'insensitive' as const } },
                { description: { contains: search, mode: 'insensitive' as const } },
                {
                  vehicle: {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' as const } },
                      {
                        manufacturer: {
                          name: { contains: search, mode: 'insensitive' as const },
                        },
                      },
                    ],
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        vehicle: {
          include: {
            manufacturer: true,
          },
        },
      },
    });

    const byId = new Map(rows.map((item) => [item.id, item]));
    const ordered = allCarIds
      .map((id) => byId.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (options?.take && options.take > 0) {
      return ordered.slice(0, options.take);
    }

    return ordered;
  }

  async findCustomersByCarId(
    ctx: AuthContext,
    carId: string,
    options?: {
      search?: string;
      take?: number;
    },
  ) {
    const links = await this.prisma.order.findMany({
      where: {
        tenantId: ctx.tenantId,
        carId,
        customerId: { not: null },
      },
      select: { customerId: true },
      distinct: ['customerId'],
      orderBy: { id: 'desc' },
    });

    const allCustomerIds = links
      .map((item) => item.customerId)
      .filter((customerId): customerId is string => Boolean(customerId));

    if (allCustomerIds.length === 0) {
      return [];
    }

    const search = options?.search?.trim();
    const rows = await this.prisma.person.findMany({
      where: {
        tenantGroupId: ctx.tenantGroupId,
        id: { in: allCustomerIds },
        ...(search
          ? {
              AND: search
                .split(/\s+/)
                .filter((term) => term.length > 0)
                .map((term) => ({
                  OR: [
                    { firstname: { contains: term, mode: 'insensitive' as const } },
                    { lastname: { contains: term, mode: 'insensitive' as const } },
                    { telephone: { contains: term, mode: 'insensitive' as const } },
                    { officePhone: { contains: term, mode: 'insensitive' as const } },
                    { email: { contains: term, mode: 'insensitive' as const } },
                  ],
                })),
            }
          : {}),
      },
      orderBy: { id: 'desc' },
    });

    const byId = new Map(rows.map((item) => [item.id, item]));
    const ordered = allCustomerIds
      .map((id) => byId.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (options?.take && options.take > 0) {
      return ordered.slice(0, options.take);
    }

    return ordered;
  }
}
