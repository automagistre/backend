import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCarInput, UpdateCarInputPrisma } from './inputs/car.input';

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
      data,
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

  async findAll() {
    return this.prisma.car.findMany();
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

  async delete(id: string) {
    return this.prisma.car.delete({ where: { id } });
  }
}
