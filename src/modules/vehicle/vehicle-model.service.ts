import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateVehicleInput, UpdateVehicleInput } from './inputs/vehicle.input';
import { cleanUpcaseString } from 'src/common/utils/clean-upcase.util';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

@Injectable()
export class VehicleModelService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateVehicleInput) {
    return this.prisma.vehicle.create({
      include: {
        manufacturer: true,
      },
      data: {
        ...data,
        caseName: data.caseName ? cleanUpcaseString(data.caseName) : null,
      },
    });
  }

  async findAll() {
    return this.prisma.vehicle.findMany({
      include: {
        manufacturer: true,
      },
    });
  }

  async findMany({ take = DEFAULT_TAKE, skip = DEFAULT_SKIP, search }: { take: number; skip: number; search?: string }) {
    let where = {};

    if (search) {
      const searchTerms = search.trim().split(/\s+/).filter(term => term.length > 0);
      
      // Каждое слово должно найтись хотя бы в одном из полей (И между словами, ИЛИ между полями)
      const andConditions = searchTerms.map(term => ({
        OR: [
          { name: { contains: term, mode: 'insensitive' as const } },
          { localizedName: { contains: term, mode: 'insensitive' as const } },
          { caseName: { contains: term, mode: 'insensitive' as const } },
          { manufacturer: { name: { contains: term, mode: 'insensitive' as const } } },
          { manufacturer: { localizedName: { contains: term, mode: 'insensitive' as const } } },
        ]
      }));

      where = { AND: andConditions };
    }

    const [items, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        where,
        take: +take,
        skip: +skip,
        include: {
          manufacturer: true,
        },
        orderBy: { id: 'desc' },
      }),
      this.prisma.vehicle.count({ where }),
    ]);

    return {
      items,
      total,
    };
  }

  async findOne(id: string) {
    return this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        manufacturer: true,
      },
    });
  }

  async update({ id, ...data }: UpdateVehicleInput) {
    if (data?.caseName) {
      data.caseName = cleanUpcaseString(data.caseName);
    }
    return this.prisma.vehicle.update({
      include: {
        manufacturer: true,
      },
      where: { id },
      data
    });
  }

  async remove(id: string) {
    return this.prisma.vehicle.delete({
      where: { id },
      include: {
        manufacturer: true,
      },
    });
  }
}
