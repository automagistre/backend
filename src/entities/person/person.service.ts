import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePersonInput } from './inputs/create.input';
import { PersonModel } from './models/person.model';
import { UpdatePersonInput } from './inputs/update.input';
import { Person } from '@prisma/client';
@Injectable()
export class PersonService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPersonInput: CreatePersonInput): Promise<Person> {
    return this.prisma.person.create({
      data: createPersonInput,
    });
  }

  findAll(): Promise<Person[]> {
    return this.prisma.person.findMany();
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
