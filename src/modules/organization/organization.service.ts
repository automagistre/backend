import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateOrganizationInput, UpdateOrganizationInput } from './inputs/organization.input';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateOrganizationInput) {
    const { requisite, ...mainData } = data as any;
    
    return this.prisma.organization.create({
      data: {
        ...mainData,
        ...(requisite && {
          requisiteBank: requisite.bank,
          requisiteLegalAddress: requisite.legalAddress,
          requisiteOgrn: requisite.ogrn,
          requisiteInn: requisite.inn,
          requisiteKpp: requisite.kpp,
          requisiteRs: requisite.rs,
          requisiteKs: requisite.ks,
          requisiteBik: requisite.bik,
        }),
      },
    });
  }

  async update({ id, requisite, ...mainData }: UpdateOrganizationInput & { requisite?: any }) {
    return this.prisma.organization.update({
      where: { id },
      data: {
        ...mainData,
        ...(requisite !== undefined && {
          requisiteBank: requisite?.bank || null,
          requisiteLegalAddress: requisite?.legalAddress || null,
          requisiteOgrn: requisite?.ogrn || null,
          requisiteInn: requisite?.inn || null,
          requisiteKpp: requisite?.kpp || null,
          requisiteRs: requisite?.rs || null,
          requisiteKs: requisite?.ks || null,
          requisiteBik: requisite?.bik || null,
        }),
      },
    });
  }

  async findMany({
    take = DEFAULT_TAKE,
    skip = DEFAULT_SKIP,
    search,
  }: {
    take?: number;
    skip?: number;
    search?: string;
  }) {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { address: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { telephone: { contains: search, mode: 'insensitive' as const } },
            { requisiteInn: { contains: search, mode: 'insensitive' as const } },
            { requisiteOgrn: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        take: +take,
        skip: +skip,
        orderBy: { id: 'desc' },
      }),
      this.prisma.organization.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(id: string) {
    return this.prisma.organization.findUnique({
      where: { id },
    });
  }

  async remove(id: string) {
    return this.prisma.organization.delete({
      where: { id },
    });
  }
}

