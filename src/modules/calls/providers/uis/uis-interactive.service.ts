import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantService } from 'src/common/services/tenant.service';
import { OrderStatus } from 'src/modules/order/enums/order-status.enum';

const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.ORDERING,
  OrderStatus.TRACKING,
  OrderStatus.WORKING,
  OrderStatus.READY,
  OrderStatus.SCHEDULING,
];

const WEEKDAY_RU: Record<number, string> = {
  1: 'понедельник',
  2: 'вторник',
  3: 'среду',
  4: 'четверг',
  5: 'пятницу',
  6: 'субботу',
  7: 'воскресенье',
};

const MONTH_RU: Record<number, string> = {
  1: 'января',
  2: 'февраля',
  3: 'марта',
  4: 'апреля',
  5: 'мая',
  6: 'июня',
  7: 'июля',
  8: 'августа',
  9: 'сентября',
  10: 'октября',
  11: 'ноября',
  12: 'декабря',
};

export interface InteractiveResponse {
  returned_code: number;
  text?: string;
  operator_text?: string;
}

/**
 * Реализует контракт `POST /uiscom/interactive` старой Symfony CRM
 * (`crm/src/ATS/Controller/InteractiveController.php`) на новом backend.
 * UIS дёргает endpoint при входящем звонке и ожидает в ответе подсказку
 * оператору и реплику для клиента (text-to-speech).
 *
 * Все даты/времена форматируем относительно UTC: в БД CalendarEntrySchedule.date
 * лежит как `timestamp without time zone` ("wall clock"), Prisma читает их
 * как Date в UTC — поэтому сравнение и форматирование тоже в UTC, иначе
 * сместим день/час.
 */
@Injectable()
export class UisInteractiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
  ) {}

  async handle(
    publicId: number,
    body: Record<string, unknown>,
  ): Promise<InteractiveResponse> {
    const tenant = await this.tenantService.findByPublicId(publicId);
    if (!tenant) return { returned_code: 1 };

    const phone = this.parsePhone(body.numa);
    if (!phone) return { returned_code: 1 };

    const person = await this.prisma.person.findFirst({
      where: { tenantGroupId: tenant.groupId, telephone: phone },
      select: { id: true, firstname: true, lastname: true },
    });
    if (!person?.firstname) return { returned_code: 1 };

    const fullName = [person.lastname ?? '', person.firstname]
      .join(' ')
      .trim();
    const message = await this.buildMessage(person.id, tenant);

    if (!message) {
      return {
        returned_code: 1,
        text: `Здравствуйте ${person.firstname}, пожалуйста дождитесь ответа оператора.`,
        operator_text: fullName,
      };
    }

    return {
      returned_code: 1,
      text: `Здравствуйте ${person.firstname}. ${message} Если у вас остались вопросы дождитесь ответа оператора.`,
      operator_text: fullName,
    };
  }

  private parsePhone(numa: unknown): string | null {
    if (typeof numa !== 'string' && typeof numa !== 'number') return null;
    const digits = String(numa).replace(/\D/g, '');
    if (digits.length < 11 || digits.length > 15) return null;
    return `+${digits}`;
  }

  private async buildMessage(
    customerId: string,
    tenant: { id: string; groupId: string },
  ): Promise<string> {
    let message = '';
    let scheduleInMessage = false;

    const entry = await this.prisma.calendarEntryOrderInfo.findFirst({
      where: {
        tenantId: tenant.id,
        customerId,
        calendarEntry: { calendarEntryDeletion: null },
      },
      orderBy: { id: 'desc' },
      select: {
        calendarEntry: {
          select: {
            calendarEntrySchedule: {
              orderBy: { id: 'desc' },
              take: 1,
              select: { date: true },
            },
          },
        },
      },
    });

    const scheduleDate = entry?.calendarEntry?.calendarEntrySchedule?.[0]?.date;
    if (scheduleDate && scheduleDate.getTime() > Date.now()) {
      scheduleInMessage = true;
      message += 'Вы записаны на ';

      const today = this.utcDayKey(new Date());
      const tomorrow = this.utcDayKey(new Date(Date.now() + 24 * 3600 * 1000));
      const dayKey = this.utcDayKey(scheduleDate);

      if (dayKey === today) {
        message += 'сегодня ';
      } else if (dayKey === tomorrow) {
        message += 'завтра ';
      } else {
        const weekday = ((scheduleDate.getUTCDay() + 6) % 7) + 1;
        const day = scheduleDate.getUTCDate();
        const month = scheduleDate.getUTCMonth() + 1;
        message += `${WEEKDAY_RU[weekday]} ${String(day).padStart(2, '0')} ${MONTH_RU[month]}`;
      }

      const hh = String(scheduleDate.getUTCHours()).padStart(2, '0');
      const mm = String(scheduleDate.getUTCMinutes()).padStart(2, '0');
      message += ` к ${hh}:${mm}.`;
    }

    const order = await this.prisma.order.findFirst({
      where: {
        tenantId: tenant.id,
        customerId,
        status: { in: ACTIVE_ORDER_STATUSES },
      },
      orderBy: { id: 'desc' },
      select: { id: true, status: true },
    });

    let orderStatusInMessage = false;
    if (order && !scheduleInMessage) {
      const phrase = this.statusPhrase(order.status as OrderStatus);
      if (phrase) {
        message += phrase;
        orderStatusInMessage = true;
      }
    }

    if (order && (scheduleInMessage || orderStatusInMessage)) {
      const forPayment = await this.calculateForPayment(order.id, tenant.id);
      if (forPayment > 0n) {
        message += ` К оплате ${this.formatRub(forPayment)} рублей.`;
      }
    }

    return message;
  }

  /**
   * Округление до целых рублей с round-half-up: 50 копеек и больше → +1 рубль.
   * Копейки в TTS-фразе только мешают: робот произносит "сорок пять тысяч девятьсот точка ноль ноль".
   */

  private statusPhrase(status: OrderStatus): string | null {
    switch (status) {
      case OrderStatus.ORDERING:
        return 'По вашему заказу осуществляется заказ запчастей.';
      case OrderStatus.TRACKING:
        return 'По вашему заказу ожидаются запчасти.';
      case OrderStatus.WORKING:
        return 'Работы по вашему автомобилю ещё не завершены.';
      case OrderStatus.READY:
        return 'Ваш автомобиль готов и ожидает вас.';
      default:
        return null;
    }
  }

  /**
   * Сумма к оплате = (стоимость работ/запчастей без warranty) - сумма уже
   * проведённых платежей по заказу. Логика повторяет
   * `OrderService.getOrderTotal` + сумма OrderPayment.
   */
  private async calculateForPayment(
    orderId: string,
    tenantId: string,
  ): Promise<bigint> {
    const items = await this.prisma.orderItem.findMany({
      where: { orderId, tenantId },
      include: { service: true, part: true },
    });
    let total = 0n;
    for (const item of items) {
      if (item.service && !item.service.warranty) {
        const p = item.service.priceAmount ?? 0n;
        const d = item.service.discountAmount ?? 0n;
        total += p - d;
      }
      if (item.part && !item.part.warranty) {
        const p = item.part.priceAmount ?? 0n;
        const d = item.part.discountAmount ?? 0n;
        total += ((p - d) * BigInt(item.part.quantity)) / 100n;
      }
    }

    const paid = await this.prisma.orderPayment.aggregate({
      where: { orderId, tenantId },
      _sum: { amountAmount: true },
    });
    const paidSum = paid._sum.amountAmount ?? 0n;

    const remaining = total - paidSum;
    return remaining > 0n ? remaining : 0n;
  }

  private formatRub(amountMinor: bigint): string {
    const rounded = (amountMinor + 50n) / 100n;
    return rounded.toString();
  }

  private utcDayKey(d: Date): string {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
}
