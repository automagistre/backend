import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePartInput } from './inputs/create.input';
import { PartModel } from './models/part.model';
import { UpdatePartInput } from './inputs/update.input';
import { cleanUpcaseString } from 'src/common/utils/clean-upcase.util';

@Injectable()
export class PartService {
  constructor(private readonly prisma: PrismaService) {}


  async findAll(): Promise<PartModel[]> {
    const parts = await this.prisma.part.findMany({
      take: 2,
      include: {
        manufacturer: true,
      },
    });
    return parts;
  }

  async findOne(id: string): Promise<PartModel | null> {
    const part = await this.prisma.part.findUnique({
      where: { id },
      include: {
        manufacturer: true,
      },
    });
    return part;
  }

  async create(input: CreatePartInput): Promise<PartModel> {
    const part = await this.prisma.part.create({
      data: {
        ...input,
        number: cleanUpcaseString(input.number),
      },
      include: {
        manufacturer: true,
      },
    });

    return part;
  }

  async update(input: UpdatePartInput): Promise<PartModel> {
    const { id, ...data } = input;
    if (data?.number) {
      data.number = cleanUpcaseString(data.number);
    }
    const part = await this.prisma.part.update({
      where: { id },
      data,
      include: {
        manufacturer: true,
      },
    });
    return part;
  }

  async delete(id: string): Promise<PartModel> {
    return await this.prisma.part.delete({
      where: { id },
      include: {
        manufacturer: true,
      },
    });
  }
}
