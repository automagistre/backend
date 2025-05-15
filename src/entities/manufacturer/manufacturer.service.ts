import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { CreateManufacturerInput } from './inputs/create.input';
import { UpdateManufacturerInput } from './inputs/update.input';
import { ManufacturerModel } from './models/manufacturer.model';

@Injectable()
export class ManufacturerService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll(): Promise<ManufacturerModel[]> {
    const manufacturers = await this.prismaService.manufacturer.findMany();
    return manufacturers;
  }

  async findMany({ take, cursor }: { take: number; cursor?: string }) {
    const items = await this.prismaService.manufacturer.findMany({
      take: +take + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
    });
    const hasMore = items.length > take;
    let nextCursor: string | null = null;

    if (hasMore) {
      items.pop();
      nextCursor = items[items.length - 1].id;
    }
    return {
      items,
      hasMore,
      nextCursor,
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
