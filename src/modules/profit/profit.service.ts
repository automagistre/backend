import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CogsService } from 'src/modules/cogs/cogs.service';
import { EmployeeService } from 'src/modules/employee/employee.service';
import { SettingsService } from 'src/modules/settings/settings.service';
import { OrderItemServiceKind } from 'src/modules/order/enums/order-item-service-kind.enum';
import { WarrantyPayerKind } from 'src/modules/order/enums/warranty-payer-kind.enum';
import { PartyKind } from 'src/common/party';
import type { AuthContext } from 'src/common/user-id.store';
import { computeLineProfit } from './compute-line-profit';
import { ProfitCostBasis } from './enums/profit-cost-basis.enum';
import { ProfitLineKind } from './enums/profit-line-kind.enum';
import { ProfitOrigin } from './enums/profit-origin.enum';

type EmployeeRow = Awaited<
  ReturnType<EmployeeService['findByPersonId']>
>;

@Injectable()
export class ProfitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cogsService: CogsService,
    private readonly employeeService: EmployeeService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Снапшот прибыли по всем работам и запчастям заказа.
   * Идемпотентен: перезаписывает строки заказа.
   */
  async snapshotOrder(
    tx: Prisma.TransactionClient,
    ctx: AuthContext,
    orderId: string,
    closedAt: Date,
    origin: ProfitOrigin = ProfitOrigin.LIVE,
  ): Promise<number> {
    const order = await tx.order.findFirst({
      where: { id: orderId, tenantId: ctx.tenantId },
      select: { id: true, tenantId: true },
    });
    if (!order) {
      throw new NotFoundException(`Заказ с ID ${orderId} не найден`);
    }

    const currencyCode = await this.settingsService.getDefaultCurrencyCode();
    const items = await tx.orderItem.findMany({
      where: { orderId, tenantId: ctx.tenantId },
      include: { service: true, part: true },
    });

    const employeeCache = new Map<string, EmployeeRow>();
    const rows: Prisma.OrderItemProfitCreateManyInput[] = [];

    for (const item of items) {
      if (item.service) {
        rows.push(
          await this.buildServiceRow(
            ctx,
            item.id,
            orderId,
            order.tenantId,
            item.service,
            closedAt,
            origin,
            currencyCode,
            employeeCache,
          ),
        );
      } else if (item.part) {
        rows.push(
          await this.buildPartRow(
            ctx,
            item.id,
            orderId,
            order.tenantId,
            item.part,
            closedAt,
            origin,
            currencyCode,
          ),
        );
      }
    }

    await tx.orderItemProfit.deleteMany({ where: { orderId } });

    if (rows.length > 0) {
      await tx.orderItemProfit.createMany({ data: rows });
    }

    return rows.length;
  }

  /** Строки снапшота прибыли по заказу (без проверки статуса заказа). */
  async findItemProfitRows(ctx: AuthContext, orderId: string) {
    return this.prisma.orderItemProfit.findMany({
      where: { orderId, tenantId: ctx.tenantId },
      include: {
        orderItem: {
          include: {
            service: true,
            part: { include: { part: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  /** Идемпотентный пересчёт снапshota для закрытой сделки (не отмены). */
  async recomputeOrderProfit(
    ctx: AuthContext,
    orderId: string,
    origin: ProfitOrigin = ProfitOrigin.LIVE,
  ): Promise<number> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId: ctx.tenantId },
      select: {
        close: {
          select: {
            orderCancel: { select: { id: true } },
            orderDeal: { select: { createdAt: true } },
          },
        },
      },
    });
    if (!order?.close?.orderDeal) {
      throw new BadRequestException('Заказ не закрыт как сделка');
    }
    if (order.close.orderCancel) {
      throw new BadRequestException('Отменённый заказ не имеет снапшота прибыли');
    }

    const closedAt = order.close.orderDeal.createdAt ?? new Date();

    return this.prisma.$transaction(async (tx) =>
      this.snapshotOrder(tx, ctx, orderId, closedAt, origin),
    );
  }

  private async buildServiceRow(
    ctx: AuthContext,
    orderItemId: string,
    orderId: string,
    tenantId: string,
    service: {
      kind: string;
      executorKind: string | null;
      executorId: string | null;
      warranty: boolean;
      warrantyPayerKind: string | null;
      priceAmount: bigint | null;
      discountAmount: bigint | null;
      costAmount: bigint | null;
    },
    closedAt: Date,
    origin: ProfitOrigin,
    currencyCode: string,
    employeeCache: Map<string, EmployeeRow>,
  ): Promise<Prisma.OrderItemProfitCreateManyInput> {
    const net = (service.priceAmount ?? 0n) - (service.discountAmount ?? 0n);
    const { cost, costBasis } = await this.resolveServiceCost(
      ctx,
      service,
      net,
      employeeCache,
    );

    const amounts = computeLineProfit({
      kind: ProfitLineKind.SERVICE,
      revenue: net,
      cost,
      warranty: service.warranty,
      warrantyPayerKind: service.warrantyPayerKind,
    });

    // Плательщик-сотрудник (сам исполнитель или другой) полностью компенсирует
    // ЗП/маржу отдельными проводками — cost для отчёта прибыли не показываем.
    const effectiveCostBasis =
      service.warranty && service.warrantyPayerKind !== WarrantyPayerKind.ORGANIZATION
        ? ProfitCostBasis.NONE
        : costBasis;

    return {
      orderItemId,
      orderId,
      tenantId,
      kind: ProfitLineKind.SERVICE,
      revenueAmount: amounts.revenueAmount,
      costAmount: amounts.costAmount,
      profitAmount: amounts.profitAmount,
      currencyCode,
      costBasis: effectiveCostBasis,
      origin,
      warranty: service.warranty,
      warrantyPayerKind: service.warrantyPayerKind,
      closedAt,
    };
  }

  private async buildPartRow(
    ctx: AuthContext,
    orderItemId: string,
    orderId: string,
    tenantId: string,
    part: {
      partId: string;
      quantity: number;
      warranty: boolean;
      warrantyPayerKind: string | null;
      priceAmount: bigint | null;
      discountAmount: bigint | null;
    },
    closedAt: Date,
    origin: ProfitOrigin,
    currencyCode: string,
  ): Promise<Prisma.OrderItemProfitCreateManyInput> {
    const unitNet =
      (part.priceAmount ?? 0n) - (part.discountAmount ?? 0n);
    const revenue = (unitNet * BigInt(part.quantity)) / 100n;

    const cogs = await this.cogsService.getPartLineCogsAtDate(
      ctx.tenantId,
      part.partId,
      part.quantity,
      closedAt,
    );
    const costBasis =
      cogs > 0n ? ProfitCostBasis.LAST_INCOME : ProfitCostBasis.NONE;

    const amounts = computeLineProfit({
      kind: ProfitLineKind.PART,
      revenue,
      cost: cogs,
      warranty: part.warranty,
      warrantyPayerKind: part.warrantyPayerKind,
    });

    return {
      orderItemId,
      orderId,
      tenantId,
      kind: ProfitLineKind.PART,
      revenueAmount: amounts.revenueAmount,
      costAmount: amounts.costAmount,
      profitAmount: amounts.profitAmount,
      currencyCode,
      costBasis,
      origin,
      warranty: part.warranty,
      warrantyPayerKind: part.warrantyPayerKind,
      closedAt,
    };
  }

  private async resolveServiceCost(
    ctx: AuthContext,
    service: {
      kind: string;
      executorKind: string | null;
      executorId: string | null;
      costAmount: bigint | null;
    },
    net: bigint,
    employeeCache: Map<string, EmployeeRow>,
  ): Promise<{ cost: bigint; costBasis: ProfitCostBasis }> {
    if (service.kind === OrderItemServiceKind.CONTRACTOR) {
      const cost = service.costAmount ?? 0n;
      return {
        cost,
        costBasis:
          cost > 0n ? ProfitCostBasis.CONTRACTOR : ProfitCostBasis.NONE,
      };
    }

    if (
      service.executorKind === PartyKind.PERSON &&
      service.executorId &&
      net > 0n
    ) {
      let employee = employeeCache.get(service.executorId);
      if (employee === undefined) {
        employee = await this.employeeService.findByPersonId(
          ctx,
          service.executorId,
        );
        employeeCache.set(service.executorId, employee);
      }
      if (employee?.ratio != null && !employee.firedAt) {
        const cost = (net * BigInt(employee.ratio)) / 100n;
        return { cost, costBasis: ProfitCostBasis.SALARY };
      }
    }

    return { cost: 0n, costBasis: ProfitCostBasis.NONE };
  }
}
