import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Point-in-time себестоимость запчасти (COGS): цена последней закупки
 * (income_part.price_amount), не позднее заданной даты.
 *
 * Используется в двух сценариях:
 * - Точечный расчёт по одной запчасти (гарантийные удержания, снапшот прибыли
 *   по позиции заказа) — {@link getPartUnitCogsAtDate} / {@link getPartLineCogsAtDate}.
 * - Массовый расчёт по многим строкам за период (аналитика маржи) — там
 *   дёргать точечный метод в цикле было бы N+1, поэтому переиспользуется
 *   только SQL-фрагмент {@link unitCogsLateralJoinSql} внутри одного агрегирующего запроса.
 */
@Injectable()
export class CogsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Себестоимость единицы запчасти на момент `atDate` (последняя закупка
   * с датой прихода не позднее `atDate`). `null` — закупок не было.
   */
  async getPartUnitCogsAtDate(
    tenantId: string,
    partId: string,
    atDate: Date,
  ): Promise<bigint | null> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ unit_cost: bigint | null }>
    >(
      `SELECT ip.price_amount AS unit_cost
       FROM income_part ip
       JOIN income i ON i.id = ip.income_id
       WHERE ip.part_id = $1::uuid
         AND ip.tenant_id = $2::uuid
         AND i.created_at <= $3
       ORDER BY i.created_at DESC
       LIMIT 1`,
      partId,
      tenantId,
      atDate,
    );
    return rows[0]?.unit_cost ?? null;
  }

  /**
   * Себестоимость позиции: unit cost × quantity (quantity в БД хранится ×100,
   * см. правило количества в проекте). `0n` — закупок не было (COGS неизвестна).
   */
  async getPartLineCogsAtDate(
    tenantId: string,
    partId: string,
    quantity: number,
    atDate: Date,
  ): Promise<bigint> {
    const unitCost = await this.getPartUnitCogsAtDate(tenantId, partId, atDate);
    if (unitCost == null) return 0n;
    return (unitCost * BigInt(quantity)) / 100n;
  }

  /**
   * SQL-фрагмент `LEFT JOIN LATERAL` для получения себестоимости единицы
   * запчасти внутри произвольного агрегирующего запроса (без N+1).
   * `partIdExpr`/`tenantIdExpr`/`asOfExpr` — SQL-выражения (ссылки на колонки
   * внешнего запроса), не значения параметров.
   */
  static unitCogsLateralJoinSql(
    partIdExpr: string,
    tenantIdExpr: string,
    asOfExpr: string,
  ): string {
    return `LEFT JOIN LATERAL (
         SELECT ip.price_amount AS unit_cost
         FROM income_part ip
         JOIN income i ON i.id = ip.income_id
         WHERE ip.part_id = ${partIdExpr}
           AND ip.tenant_id = ${tenantIdExpr}
           AND i.created_at <= ${asOfExpr}
         ORDER BY i.created_at DESC
         LIMIT 1
       ) lc ON TRUE`;
  }
}
