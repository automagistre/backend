import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MePerson } from './models/me-person.model';

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Поиск текущего пользователя по телефону в рамках tenant group.
   * Сравнение по последним 10 цифрам — пользователь может ввести
   * номер в любом формате (8XXX, +7XXX, 7XXX), а в БД храниться
   * формат +7XXX. Точно совпадает только хвост.
   */
  async findPersonByPhone(
    tenantGroupId: string,
    phone: string,
  ): Promise<MePerson | null> {
    const last10 = this.last10Digits(phone);
    if (!last10) return null;

    const person = await this.prisma.person.findFirst({
      where: {
        tenantGroupId,
        OR: [
          { telephone: { endsWith: last10 } },
          { officePhone: { endsWith: last10 } },
        ],
      },
      select: {
        id: true,
        firstname: true,
        lastname: true,
        telephone: true,
        officePhone: true,
        email: true,
      },
    });

    return person ?? null;
  }

  private last10Digits(phone: string): string | null {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return null;
    return digits.slice(-10);
  }
}
