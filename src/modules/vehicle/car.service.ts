import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCarInput, UpdateCarInputPrisma } from './inputs/car.input';
import { PaginatedCars } from './inputs/paginatedCar.type';

@Injectable()
export class CarService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateCarInput) {
    return this.prisma.car.create({
      include: {
        vehicle: {
          include: {
            manufacturer: true,
          },
        },
      },
      data: {
        ...data,
        mileage: 0, // Пробег всегда 0 при создании, изменяется через заказы
      },
    });
  }

  async update({ id, ...data }: UpdateCarInputPrisma) {
    return this.prisma.car.update({
      include: {
        vehicle: {
          include: {
            manufacturer: true,
          },
        },
      },
      where: { id },
      data,
    });
  }

  async findMany({
    take,
    skip,
    search,
  }: {
    take?: number;
    skip?: number;
    search?: string;
  }) {
    const where = search
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
      : {};

    const [items, total] = await Promise.all([
      this.prisma.car.findMany({
        take,
        skip,
        where,
        include: {
          vehicle: {
            include: {
              manufacturer: true,
            },
          },
        },
        orderBy: { id: 'desc' },
      }),
      this.prisma.car.count({ where }),
    ]);

    return { items, total };
  }

  async findById(id: string) {
    return this.prisma.car.findUnique({
      where: { id },
      include: {
        vehicle: {
          include: {
            manufacturer: true,
          },
        },
      },
    });
  }

  async findByIdentifier(identifier: string) {
    return this.prisma.car.findFirst({
      where: { identifier },
      include: {
        vehicle: {
          include: {
            manufacturer: true,
          },
        },
      },
    });
  }

  async delete(id: string) {
    return this.prisma.car.delete({ where: { id } });
  }
}
