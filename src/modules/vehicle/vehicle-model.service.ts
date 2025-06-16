import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateVehicleInput, UpdateVehicleInput } from './inputs/vehicle.input';
import { cleanUpcaseString } from 'src/common/utils/clean-upcase.util';

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
