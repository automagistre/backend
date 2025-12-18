import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePartInput } from './inputs/create.input';
import { PartModel } from './models/part.model';
import { UpdatePartInput } from './inputs/update.input';
import { cleanUpcaseString } from 'src/common/utils/clean-upcase.util';
import { TenantService } from '../../common/services/tenant.service';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

@Injectable()
export class PartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
  ) {}


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
    const { id, orderFromQuantity, orderUpToQuantity, ...data } = input;
    if (data?.number) {
      data.number = cleanUpcaseString(data.number);
    }

    const part = await this.prisma.$transaction(async (tx) => {
      const updatedPart = await tx.part.update({
        where: { id },
        data,
        include: {
          manufacturer: true,
        },
      });

      const tenantId = await this.tenantService.getTenantId();

      // Обработка PartRequiredAvailability
      // Обрабатываем только если заданы оба поля
      if (
        orderFromQuantity !== undefined && orderFromQuantity !== null &&
        orderUpToQuantity !== undefined && orderUpToQuantity !== null
      ) {
        // Валидация
        if (orderFromQuantity < 0 || orderUpToQuantity < 0) {
          throw new Error(
            'orderFromQuantity и orderUpToQuantity должны быть >= 0',
          );
        }
        if (
          orderUpToQuantity !== 0 &&
          orderFromQuantity >= orderUpToQuantity
        ) {
          throw new Error(
            'orderUpToQuantity должен быть > orderFromQuantity (или равен 0)',
          );
        }

        // Историческая система: всегда создаем новую запись (как с ценой)
        // Даже если оба поля = 0, создаем запись (это означает "запасы не контролируются")
        await tx.partRequiredAvailability.create({
          data: {
            partId: id,
            tenantId,
            orderFromQuantity,
            orderUpToQuantity,
          },
        });
      }

      return updatedPart;
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
