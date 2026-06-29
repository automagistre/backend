import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { orderTitle } from 'src/common/utils/entity-title.util';
import { v6 as uuidv6 } from 'uuid';
import {
  AuditAction,
  AuditChangeKind,
  AuditEntityType,
  AuditScope,
} from './enums/audit.enums';
import {
  AuditFieldKind,
  AuditMoney,
  AuditRawChange,
  AuditRelationRef,
  AuditValue,
  getAuditEntityDef,
} from './audit-entity.registry';
import { AuditChangeModel } from './models/audit-change.model';
import { AuditLogEventModel } from './models/audit-log-event.model';
import { DisplayContextService } from 'src/modules/display-context/display-context.service';

type DbClient = Prisma.TransactionClient | PrismaService;

/** Минимальный актор: AuthContext подходит, но движения передают усечённый набор. */
export interface AuditActor {
  userId: string;
  tenantId?: string | null;
  tenantGroupId?: string | null;
}

export interface AuditRecordParams {
  rootEntityType: AuditEntityType;
  rootEntityId: string;
  entityType: AuditEntityType;
  entityId: string;
  /** Если не указан — выводится из before/after. */
  action?: AuditAction;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  /** Явные изменения (для движений); если заданы — diff не считается. */
  changes?: AuditRawChange[];
  /** Подписи значений-связей на момент события: { field: { old, new } }. */
  displays?: Record<string, { old?: string | null; new?: string | null }>;
  entityDisplayName?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Переопределяет scope из реестра (для сквозных сущностей, напр. NOTE). */
  scope?: AuditScope;
}

const DERIVED_ACTIONS: AuditAction[] = [
  AuditAction.CREATE,
  AuditAction.UPDATE,
  AuditAction.DELETE,
];

@Injectable()
export class AuditLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly displayContext: DisplayContextService,
  ) {}

  /**
   * Записать событие аудита. Вызывать внутри той же транзакции, что и бизнес-запись
   * (передать tx первым аргументом); вне транзакции допустимо передать prisma.
   */
  async record(
    client: DbClient,
    actor: AuditActor,
    params: AuditRecordParams,
  ): Promise<void> {
    const def = getAuditEntityDef(params.entityType);
    if (!def) return;

    const action = params.action ?? this.inferAction(params.before, params.after);
    const changes =
      params.changes ??
      this.buildDiff(params.entityType, action, params.before, params.after, params.displays);

    // Шум от пустых селективных апдейтов не пишем; явные бизнес-действия — пишем всегда.
    if (changes.length === 0 && DERIVED_ACTIONS.includes(action)) {
      return;
    }

    // Денормализуем читаемые имена связей на момент события (id → название).
    await this.enrichRelationDisplays(params.entityType, changes);

    const scope = params.scope ?? def.scope;
    const tenantId = scope === AuditScope.TENANT ? (actor.tenantId ?? null) : null;
    const tenantGroupId =
      scope === AuditScope.GROUP ? (actor.tenantGroupId ?? null) : null;

    await client.auditLogEvent.create({
      data: {
        id: uuidv6(),
        scope,
        tenantId,
        tenantGroupId,
        rootEntityType: params.rootEntityType,
        rootEntityId: params.rootEntityId,
        entityType: params.entityType,
        entityId: params.entityId,
        action,
        actorId: actor.userId ?? null,
        entityDisplayName: params.entityDisplayName ?? null,
        changes: changes as unknown as Prisma.InputJsonValue,
        metadata: (params.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  /** История агрегата (и его дочерних сущностей) с авторизацией по scope. */
  async findByRoot(
    actor: AuditActor,
    args: {
      rootEntityType: AuditEntityType;
      rootEntityId: string;
      entityTypes?: AuditEntityType[];
      take?: number;
      skip?: number;
    },
  ): Promise<{ items: AuditLogEventModel[]; total: number }> {
    const scopeOr: Prisma.AuditLogEventWhereInput[] = [];
    if (actor.tenantId) {
      scopeOr.push({ scope: AuditScope.TENANT, tenantId: actor.tenantId });
    }
    if (actor.tenantGroupId) {
      scopeOr.push({ scope: AuditScope.GROUP, tenantGroupId: actor.tenantGroupId });
    }

    const where: Prisma.AuditLogEventWhereInput = {
      rootEntityType: args.rootEntityType,
      rootEntityId: args.rootEntityId,
      ...(args.entityTypes?.length ? { entityType: { in: args.entityTypes } } : {}),
      ...(scopeOr.length ? { OR: scopeOr } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.auditLogEvent.findMany({
        where,
        orderBy: { id: 'desc' },
        take: args.take ?? 25,
        skip: args.skip ?? 0,
      }),
      this.prisma.auditLogEvent.count({ where }),
    ]);

    const items = rows.map((row) => this.toModel(row));
    await this.enrichContext(items);
    return { items, total };
  }

  /** Общий журнал активности по tenant/group (без привязки к агрегату). */
  async findActivity(
    actor: AuditActor,
    args: {
      entityTypes?: AuditEntityType[];
      actorId?: string;
      take?: number;
      skip?: number;
    },
  ): Promise<{ items: AuditLogEventModel[]; total: number }> {
    const scopeOr: Prisma.AuditLogEventWhereInput[] = [];
    if (actor.tenantId) {
      scopeOr.push({ scope: AuditScope.TENANT, tenantId: actor.tenantId });
    }
    if (actor.tenantGroupId) {
      scopeOr.push({ scope: AuditScope.GROUP, tenantGroupId: actor.tenantGroupId });
    }

    const where: Prisma.AuditLogEventWhereInput = {
      ...(args.entityTypes?.length ? { entityType: { in: args.entityTypes } } : {}),
      ...(args.actorId ? { actorId: args.actorId } : {}),
      ...(scopeOr.length ? { OR: scopeOr } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.auditLogEvent.findMany({
        where,
        orderBy: { id: 'desc' },
        take: args.take ?? 25,
        skip: args.skip ?? 0,
      }),
      this.prisma.auditLogEvent.count({ where }),
    ]);

    const items = rows.map((row) => this.toModel(row));
    await this.enrichContext(items);
    return { items, total };
  }

  /** Типы, для которых в списке показываем контекст «Заказ №X · Авто». */
  private static readonly ORDER_CONTEXT_TYPES: AuditEntityType[] = [
    AuditEntityType.ORDER_ITEM_GROUP,
    AuditEntityType.ORDER_ITEM_SERVICE,
    AuditEntityType.ORDER_ITEM_PART,
    AuditEntityType.RESERVATION,
  ];

  /** Типы, для которых контекст — автомобиль (root = CAR). */
  private static readonly CAR_CONTEXT_TYPES: AuditEntityType[] = [
    AuditEntityType.CAR_RECOMMENDATION,
    AuditEntityType.CAR_RECOMMENDATION_PART,
  ];

  /**
   * Заполняет contextLabel/contextLink батчем по типу сущности:
   * элементы заказа/резерв → «Заказ №X · Авто» (ссылка на заказ),
   * рекомендации → «Авто». Проводка/зарплата контекст не требуют —
   * person/org уже в entityDisplayName.
   */
  private async enrichContext(items: AuditLogEventModel[]): Promise<void> {
    await Promise.all([
      this.enrichOrderContext(items),
      this.enrichCarContext(items),
    ]);
  }

  private async enrichOrderContext(
    items: AuditLogEventModel[],
  ): Promise<void> {
    const orderItems = items.filter((i) =>
      AuditLogService.ORDER_CONTEXT_TYPES.includes(i.entityType),
    );
    const orderIds = Array.from(new Set(orderItems.map((i) => i.rootEntityId)));
    if (orderIds.length === 0) return;

    const orders = await this.prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, number: true, carId: true },
    });
    const orderById = new Map(orders.map((o) => [o.id, o]));

    const carIds = Array.from(
      new Set(orders.map((o) => o.carId).filter((id): id is string => !!id)),
    );
    const carDisplayById = await this.loadCarDisplays(carIds);

    for (const item of orderItems) {
      const order = orderById.get(item.rootEntityId);
      if (!order) continue;
      const carDisplay = order.carId ? carDisplayById.get(order.carId) : null;
      item.contextLabel = carDisplay
        ? `${orderTitle(order.number)} · ${carDisplay}`
        : orderTitle(order.number);
      item.contextLink = `/orders/${order.id}`;
    }
  }

  private async enrichCarContext(items: AuditLogEventModel[]): Promise<void> {
    const carItems = items.filter((i) =>
      AuditLogService.CAR_CONTEXT_TYPES.includes(i.entityType),
    );
    const carIds = Array.from(new Set(carItems.map((i) => i.rootEntityId)));
    if (carIds.length === 0) return;

    const carDisplayById = await this.loadCarDisplays(carIds);
    for (const item of carItems) {
      item.contextLabel = carDisplayById.get(item.rootEntityId) ?? null;
    }
  }

  private async loadCarDisplays(
    carIds: string[],
  ): Promise<Map<string, string | null>> {
    if (carIds.length === 0) return new Map();
    return new Map(
      await Promise.all(
        carIds.map(
          async (id) =>
            [id, await this.displayContext.getCarDisplay(id)] as const,
        ),
      ),
    );
  }

  private toModel(row: {
    id: string;
    rootEntityType: string;
    rootEntityId: string;
    entityType: string;
    entityId: string;
    action: string;
    actorId: string | null;
    entityDisplayName: string | null;
    changes: Prisma.JsonValue | null;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
  }): AuditLogEventModel {
    const entityType = row.entityType as AuditEntityType;
    const raw = (row.changes as unknown as AuditRawChange[] | null) ?? [];
    return {
      id: row.id,
      rootEntityType: row.rootEntityType as AuditEntityType,
      rootEntityId: row.rootEntityId,
      contextLabel: null,
      contextLink: null,
      entityType,
      entityId: row.entityId,
      action: row.action as AuditAction,
      actorId: row.actorId,
      entityDisplayName: row.entityDisplayName,
      changes: this.formatChanges(entityType, raw),
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      createdAt: row.createdAt,
    };
  }

  /** Заполняет oldDisplay/newDisplay для relation-полей, у которых ещё нет подписи. */
  private async enrichRelationDisplays(
    entityType: AuditEntityType,
    changes: AuditRawChange[],
  ): Promise<void> {
    const def = getAuditEntityDef(entityType);
    for (const change of changes) {
      const kind = def?.fields[change.field]?.kind;
      if (!kind || kind.kind !== 'relation') continue;

      if (change.oldDisplay === undefined && typeof change.oldValue === 'string') {
        change.oldDisplay = await this.resolveRelationName(kind.ref, change.oldValue);
      }
      if (change.newDisplay === undefined && typeof change.newValue === 'string') {
        change.newDisplay = await this.resolveRelationName(kind.ref, change.newValue);
      }
    }
  }

  /** Резолвинг читаемых подписей делегирован в DisplayContextService (единый источник). */
  private async resolveRelationName(
    ref: AuditRelationRef,
    id: string,
  ): Promise<string | null> {
    switch (ref) {
      case 'part':
        return this.displayContext.getPartName(id);
      case 'organization':
        return this.displayContext.getOrganizationName(id);
      case 'operand':
        return this.displayContext.getOperandDisplayName(id);
      case 'car':
        return this.displayContext.getCarDisplay(id);
      case 'vehicle':
        return this.displayContext.getVehicleName(id);
      case 'orderItem':
        return this.displayContext.getOrderItemDisplay(id);
      case 'manufacturer':
        return this.displayContext.getManufacturerName(id);
      default:
        return null;
    }
  }

  private inferAction(
    before?: Record<string, any> | null,
    after?: Record<string, any> | null,
  ): AuditAction {
    if (!before && after) return AuditAction.CREATE;
    if (before && !after) return AuditAction.DELETE;
    return AuditAction.UPDATE;
  }

  private buildDiff(
    entityType: AuditEntityType,
    action: AuditAction,
    before?: Record<string, any> | null,
    after?: Record<string, any> | null,
    displays?: Record<string, { old?: string | null; new?: string | null }>,
  ): AuditRawChange[] {
    const def = getAuditEntityDef(entityType);
    const oldRow = action === AuditAction.CREATE ? {} : (before ?? {});
    const newRow = action === AuditAction.DELETE ? {} : (after ?? {});
    const changes: AuditRawChange[] = [];

    for (const [field, fieldDef] of Object.entries(def.fields)) {
      const oldValue = this.serialize(fieldDef.kind, oldRow[field], oldRow);
      const newValue = this.serialize(fieldDef.kind, newRow[field], newRow);
      if (this.valuesEqual(oldValue, newValue)) continue;

      const change: AuditRawChange = { field, oldValue, newValue };
      const d = displays?.[field];
      if (d) {
        if (d.old !== undefined) change.oldDisplay = d.old;
        if (d.new !== undefined) change.newDisplay = d.new;
      }
      changes.push(change);
    }

    return changes;
  }

  private serialize(
    kind: AuditFieldKind,
    value: unknown,
    row: Record<string, any>,
  ): AuditValue {
    if (value === null || value === undefined) return null;

    switch (kind.kind) {
      case 'money': {
        const currencyCode = kind.currencyField
          ? (row[kind.currencyField] ?? '')
          : '';
        return { amountMinor: String(value), currencyCode } as AuditMoney;
      }
      case 'bool':
        return Boolean(value);
      case 'date':
      case 'datetime':
        return value instanceof Date ? value.toISOString() : String(value);
      case 'quantity':
      case 'status':
        return typeof value === 'bigint' ? Number(value) : (value as number);
      case 'relation':
      case 'scalar':
      default:
        return typeof value === 'bigint' ? String(value) : (value as AuditValue);
    }
  }

  private valuesEqual(a: AuditValue, b: AuditValue): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private formatChanges(
    entityType: AuditEntityType,
    raw: AuditRawChange[],
  ): AuditChangeModel[] {
    const def = getAuditEntityDef(entityType);
    return raw.map((change) => {
      const fieldDef = def?.fields[change.field];
      const kind: AuditFieldKind = fieldDef?.kind ?? { kind: 'scalar' };
      const [presentKind, oldValue, newValue] = this.presentChange(kind, change);
      return {
        field: change.field,
        label: fieldDef?.label ?? change.field,
        kind: presentKind,
        oldValue,
        newValue,
      };
    });
  }

  /**
   * Готовит вид значения и сырые данные для фронта.
   * Форматирование денег/количества/дат выполняется на фронте через utils,
   * здесь только сырые значения и доменные подписи (статусы, relation-имена).
   */
  private presentChange(
    kind: AuditFieldKind,
    change: AuditRawChange,
  ): [AuditChangeKind, unknown, unknown] {
    switch (kind.kind) {
      case 'money':
        return [
          AuditChangeKind.MONEY,
          change.oldValue ?? null,
          change.newValue ?? null,
        ];
      case 'quantityX100':
        return [
          AuditChangeKind.QUANTITY,
          change.oldValue ?? null,
          change.newValue ?? null,
        ];
      case 'date':
        return [
          AuditChangeKind.DATE,
          change.oldValue ?? null,
          change.newValue ?? null,
        ];
      case 'datetime':
        return [
          AuditChangeKind.DATETIME,
          change.oldValue ?? null,
          change.newValue ?? null,
        ];
      case 'duration':
        return [
          AuditChangeKind.DURATION,
          change.oldValue ?? null,
          change.newValue ?? null,
        ];
      case 'bool':
        return [
          AuditChangeKind.BOOL,
          change.oldValue === null || change.oldValue === undefined
            ? null
            : Boolean(change.oldValue),
          change.newValue === null || change.newValue === undefined
            ? null
            : Boolean(change.newValue),
        ];
      case 'status':
        return [
          AuditChangeKind.TEXT,
          this.statusLabel(kind, change.oldValue),
          this.statusLabel(kind, change.newValue),
        ];
      case 'relation':
        return [
          AuditChangeKind.TEXT,
          change.oldDisplay ?? this.textValue(change.oldValue),
          change.newDisplay ?? this.textValue(change.newValue),
        ];
      case 'quantity':
      case 'scalar':
      default:
        return [
          AuditChangeKind.TEXT,
          this.textValue(change.oldValue),
          this.textValue(change.newValue),
        ];
    }
  }

  private statusLabel(
    kind: Extract<AuditFieldKind, { kind: 'status' }>,
    value: AuditValue,
  ): string | null {
    if (value === null || value === undefined) return null;
    return kind.labels[Number(value)] ?? String(value);
  }

  private textValue(value: AuditValue): string | null {
    if (value === null || value === undefined) return null;
    return String(value);
  }
}
