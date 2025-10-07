import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePartInput } from './inputs/create.input';
import { PartModel } from './models/part.model';
import { UpdatePartInput } from './inputs/update.input';
import { cleanUpcaseString } from 'src/common/utils/clean-upcase.util';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

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

  async findMany({ take=DEFAULT_TAKE, skip=DEFAULT_SKIP, search }: { take: number; skip: number; search?: string }) {
    let where = {};

    if (search) {
      const searchTerms = search.trim().split(/\s+/).filter(term => term.length > 0);
      
      const andConditions = searchTerms.map(term => ({
        OR: [
          { name: { contains: term, mode: 'insensitive' as const } },
          { number: { contains: term, mode: 'insensitive' as const } },
          { manufacturer: { name: { contains: term, mode: 'insensitive' as const } } },
          { manufacturer: { localizedName: { contains: term, mode: 'insensitive' as const } } },
        ],
      }));

      where = { AND: andConditions };
    }

    const [items, total] = await Promise.all([
      this.prisma.part.findMany({
        where,
        take: +take,
        skip: +skip,
        include: {
          manufacturer: true,
        },
        orderBy: [{ id: 'desc' }],
      }),
      this.prisma.part.count({ where }),
    ]);

    return {
      items,
      total,
    };
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
