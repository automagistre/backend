import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePersonInput } from './inputs/create.input';
import { UpdatePersonInput } from './inputs/update.input';
import { Person } from '@prisma/client';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

@Injectable()
export class PersonService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPersonInput: CreatePersonInput): Promise<Person> {
    return this.prisma.person.create({
      data: createPersonInput,
    });
  }

  findAll(): Promise<Person[]> {
    return this.prisma.person.findMany({
      orderBy: [{ id: 'desc' }],
    });
  }

  async findMany({
    take = DEFAULT_TAKE,
    skip = DEFAULT_SKIP,
    search,
  }: {
    take: number;
    skip: number;
    search?: string;
  }) {
    let where = {};

    if (search) {
      const searchTerms = search
        .trim()
        .split(/\s+/)
        .filter((term) => term.length > 0);

      const andConditions = searchTerms.map((term) => ({
        OR: [
          { firstname: { contains: term, mode: 'insensitive' as const } },
          { lastname: { contains: term, mode: 'insensitive' as const } },
          { telephone: { contains: term, mode: 'insensitive' as const } },
          { officePhone: { contains: term, mode: 'insensitive' as const } },
          { email: { contains: term, mode: 'insensitive' as const } },
        ],
      }));

      where = { AND: andConditions };
    }

    const [items, total] = await Promise.all([
      this.prisma.person.findMany({
        where,
        take: +take,
        skip: +skip,
        orderBy: [{ id: 'desc' }],
      }),
      this.prisma.person.count({ where }),
    ]);

    return {
      items,
      total,
    };
  }

  async findOne(id: string): Promise<Person | null> {
    return this.prisma.person.findUnique({
      where: { id },
    });
  }

  async update(updatePersonInput: UpdatePersonInput): Promise<Person> {
    const { id, ...data } = updatePersonInput;
    return this.prisma.person.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Person> {
    return this.prisma.person.delete({
      where: { id },
    });
  }
}
