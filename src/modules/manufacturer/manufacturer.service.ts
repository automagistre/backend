import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { CreateManufacturerInput } from './inputs/create.input';
import { UpdateManufacturerInput } from './inputs/update.input';
import { ManufacturerModel } from './models/manufacturer.model';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

@Injectable()
export class ManufacturerService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll(): Promise<ManufacturerModel[]> {
    const manufacturers = await this.prismaService.manufacturer.findMany();
    return manufacturers;
  }

  async findMany({ take=DEFAULT_TAKE, skip=DEFAULT_SKIP }: { take: number; skip: number }) {
    const [items, total] = await Promise.all([
      this.prismaService.manufacturer.findMany({
        take: +take,
        skip: +skip,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prismaService.manufacturer.count(),
    ]);

    return {
      items,
      total,
    };
  }

  async findOne(id: string): Promise<ManufacturerModel | null> {
    return await this.prismaService.manufacturer.findUnique({ where: { id } });
  }

  async create(input: CreateManufacturerInput): Promise<ManufacturerModel> {
    const manufacturer = await this.prismaService.manufacturer.create({
      data: input,
    });
    return manufacturer;
  }

  async update({
    id,
    ...data
  }: UpdateManufacturerInput): Promise<ManufacturerModel> {
    const manufacturer = await this.prismaService.manufacturer.update({
      where: { id },
      data: data,
    });
    return manufacturer;
  }

  async remove(id: string): Promise<ManufacturerModel> {
    return await this.prismaService.manufacturer.delete({ where: { id } });
  }
}
