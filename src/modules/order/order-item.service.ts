import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderService } from './order.service';
import { OrderItemModel } from './models/order-item.model';
import { CreateOrderItemGroupInput } from './inputs/create-order-item-group.input';
import { CreateOrderItemServiceInput } from './inputs/create-order-item-service.input';
import { CreateOrderItemPartInput } from './inputs/create-order-item-part.input';
import { UpdateOrderItemPartInput } from './inputs/update-order-item-part.input';
import { UpdateOrderItemServiceInput } from './inputs/update-order-item-service.input';
import { UpdateOrderItemGroupInput } from './inputs/update-order-item-group.input';
import { ApplyOrderWarrantyInput } from './inputs/apply-order-warranty.input';
import { ApplyOrderWarrantyPayload } from './models/apply-order-warranty.payload';
import { WarrantyPayerKind } from './enums/warranty-payer-kind.enum';
import { NoteService } from 'src/modules/note/note.service';
import {
  OrderItem,
  OrderItemGroup,
  OrderItemService as PrismaOrderItemService,
  OrderItemPart,
  Prisma,
} from 'src/generated/prisma/client';
import { OrderItemType } from './enums/order-item-type.enum';
import { OrderItemServiceKind } from './enums/order-item-service-kind.enum';
import { expandWarrantyItemIds, isContractorService } from './warranty-payer.resolve';
import { executorToDb, PartyKind } from 'src/common/party';
import { WalletTransactionService } from 'src/modules/wallet/wallet-transaction.service';
import { v6 as uuidv6 } from 'uuid';
import { ReservationService } from '../reservation/reservation.service';
import { applyDefaultCurrency } from 'src/common/money';
import { normalizeMoneyAmount } from 'src/common/utils/money.util';
import { SettingsService } from 'src/modules/settings/settings.service';
import type { AuthContext } from 'src/common/user-id.store';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import {
  AuditAction,
  AuditEntityType,
} from 'src/modules/audit-log/enums/audit.enums';

@Injectable()
export class OrderItemService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
    @Inject(forwardRef(() => ReservationService))
    private readonly reservationService: ReservationService,
    private readonly settingsService: SettingsService,
    private readonly auditLog: AuditLogService,
    private readonly walletTransactionService: WalletTransactionService,
    private readonly noteService: NoteService,
  ) {}

  async findTreeByOrderId(orderId: string): Promise<OrderItemModel[]> {
    const items = await this.prisma.orderItem.findMany({
      where: { orderId },
      include: {
        group: true,
        service: true,
        part: {
          include: {
            part: {
              include: {
                manufacturer: true,
              },
            },
            supplier: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    return this.buildTree(items);
  }

  private buildTree(
    items: (OrderItem & {
      group: OrderItemGroup | null;
      service: PrismaOrderItemService | null;
      part:
        | (OrderItemPart & {
            part: (any & { manufacturer: any }) | null;
            supplier: any | null;
          })
        | null;
    })[],
  ): OrderItemModel[] {
    const map = new Map<string, OrderItemModel>();
    const roots: OrderItemModel[] = [];

    items.forEach((item) => {
      map.set(item.id, this.toModel(item));
    });

    items.forEach((item) => {
      const model = map.get(item.id)!;
      if (item.parentId) {
        const parent = map.get(item.parentId);
        if (parent) {
          parent.children.push(model);
        }
      } else {
        roots.push(model);
      }
    });

    return roots;
  }

  private toModel(
    item: OrderItem & {
      group: OrderItemGroup | null;
      service: PrismaOrderItemService | null;
      part:
        | (OrderItemPart & {
            part: (any & { manufacturer: any }) | null;
            supplier: any | null;
          })
        | null;
    },
  ): OrderItemModel {
    const { group, service, part, type, ...orderItemData } = item;

    // Нормализуем тип из БД (может быть '1', '2', '3' или 'group', 'service', 'part')
    const normalizedType = this.normalizeType(type);

    // Явно создаем объекты с правильной структурой для GraphQL
    return {
      ...orderItemData,
      type: normalizedType,
      group: group ? { ...group } : null,
      service: service
        ? {
            id: service.id,
            service: service.service,
            kind: service.kind as any,
            executorKind: service.executorKind as any,
            executorId: service.executorId,
            warranty: service.warranty,
            warrantyPayerKind: service.warrantyPayerKind as any,
            warrantyPayerPersonId: service.warrantyPayerPersonId,
            priceAmount: service.priceAmount,
            priceCurrencyCode: service.priceCurrencyCode,
            discountAmount: service.discountAmount,
            discountCurrencyCode: service.discountCurrencyCode,
            costAmount: service.costAmount,
            costCurrencyCode: service.costCurrencyCode,
            costWalletId: service.costWalletId,
            createdAt: service.createdAt,
            createdBy: service.createdBy,
            // worker будет загружен через ResolveField
          }
        : null,
      part: part
        ? {
            ...part,
            warrantyPayerKind: part.warrantyPayerKind as any,
            part: part.part,
            supplier: part.supplier,
          }
        : null,
      children: [],
    };
  }

  /**
   * Нормализует тип элемента заказа из БД в enum
   * В БД может храниться как число ('1', '2', '3') или строка ('group', 'service', 'part')
   */
  private normalizeType(type: string | number): OrderItemType {
    // Преобразуем в строку для единообразной обработки
    const typeStr = String(type);

    // Маппинг числовых типов: 1 = service, 2 = part, 3 = group
    const typeMap: Record<string, OrderItemType> = {
      '1': OrderItemType.SERVICE,
      '2': OrderItemType.PART,
      '3': OrderItemType.GROUP,
      service: OrderItemType.SERVICE,
      part: OrderItemType.PART,
      group: OrderItemType.GROUP,
    };

    return typeMap[typeStr] || OrderItemType.SERVICE; // По умолчанию service
  }

  async createGroup(
    ctx: AuthContext,
    input: CreateOrderItemGroupInput,
  ): Promise<OrderItemModel> {
    const { tenantId, userId } = ctx;
    await this.orderService.validateOrderEditable(ctx, input.orderId);

    const orderItem = await this.prisma.orderItem.create({
      data: {
        id: uuidv6(),
        orderId: input.orderId,
        parentId: input.parentId,
        type: '3',
        tenantId,
        group: {
          create: {
            name: input.name,
            hideParts: input.hideParts ?? false,
            createdBy: userId,
          },
        },
      },
      include: { group: true },
    });

    await this.auditLog.record(this.prisma, ctx, {
      rootEntityType: AuditEntityType.ORDER,
      rootEntityId: input.orderId,
      entityType: AuditEntityType.ORDER_ITEM_GROUP,
      entityId: orderItem.id,
      action: AuditAction.CREATE,
      after: { ...orderItem.group, parentId: orderItem.parentId },
      entityDisplayName: orderItem.group?.name ?? null,
    });

    return this.toModel(orderItem as any);
  }

  async updateGroup(
    ctx: AuthContext,
    input: UpdateOrderItemGroupInput,
  ): Promise<OrderItemModel> {
    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: input.id },
      include: { group: true },
    });

    if (!orderItem) {
      throw new NotFoundException(`Элемент заказа с ID ${input.id} не найден`);
    }

    if (!orderItem.group) {
      throw new NotFoundException(
        `Элемент заказа с ID ${input.id} не является группой`,
      );
    }

    await this.orderService.validateOrderEditable(ctx, orderItem.orderId!);

    const updateData: { name?: string; hideParts?: boolean } = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.hideParts != null) updateData.hideParts = input.hideParts;

    if (Object.keys(updateData).length > 0) {
      await this.prisma.orderItemGroup.update({
        where: { id: input.id },
        data: updateData,
      });
      await this.auditLog.record(this.prisma, ctx, {
        rootEntityType: AuditEntityType.ORDER,
        rootEntityId: orderItem.orderId!,
        entityType: AuditEntityType.ORDER_ITEM_GROUP,
        entityId: input.id,
        action: AuditAction.UPDATE,
        before: { ...orderItem.group, parentId: orderItem.parentId },
        after: { ...orderItem.group, ...updateData, parentId: orderItem.parentId },
        entityDisplayName: updateData.name ?? orderItem.group?.name ?? null,
      });
    }

    const updated = await this.prisma.orderItem.findUnique({
      where: { id: input.id },
      include: {
        group: true,
        service: true,
        part: {
          include: {
            part: {
              include: {
                manufacturer: true,
              },
            },
            supplier: true,
          },
        },
      },
    });

    return this.toModel(updated as any);
  }

  /**
   * Проверка согласованности вида работы и исполнителя:
   * подрядная работа — организация или персона-неcотрудник, своя — не организация.
   */
  private async validateServiceKind(
    ctx: AuthContext,
    kind: string,
    executor: { kind: string | null; id: string | null },
  ): Promise<void> {
    if (kind === OrderItemServiceKind.CONTRACTOR) {
      if (executor.kind === PartyKind.PERSON && executor.id) {
        const employee = await this.prisma.employee.findFirst({
          where: {
            personId: executor.id,
            firedAt: null,
            tenantId: ctx.tenantId,
          },
          select: { id: true },
        });
        if (employee) {
          throw new BadRequestException(
            'Сотрудник не может быть исполнителем подрядной работы',
          );
        }
      }
    } else if (executor.kind === PartyKind.ORGANIZATION) {
      throw new BadRequestException(
        'Организация может быть исполнителем только подрядной работы',
      );
    }
  }

  /** Себестоимость допустима только для подрядной работы и только вместе со счётом. */
  private validateServiceCost(
    kind: string,
    costAmount: bigint | null,
    costWalletId: string | null,
  ): void {
    if (costAmount != null && kind !== OrderItemServiceKind.CONTRACTOR) {
      throw new BadRequestException(
        'Себестоимость доступна только для подрядной работы',
      );
    }
    if (costAmount != null && costAmount > 0n && !costWalletId) {
      throw new BadRequestException('Не указан счёт оплаты подрядчику');
    }
  }

  /** Плательщик = EMPLOYEE допустим только для действующего сотрудника (не подрядчика). */
  private async validatePayerSelection(
    ctx: AuthContext,
    payerKind: WarrantyPayerKind | null | undefined,
    payerPersonId: string | null | undefined,
    subject: string,
  ): Promise<void> {
    if (!payerKind) {
      throw new BadRequestException(
        `Укажите плательщика гарантии для ${subject}`,
      );
    }
    if (payerKind === WarrantyPayerKind.EMPLOYEE) {
      if (!payerPersonId) {
        throw new BadRequestException('Укажите сотрудника-плательщика гарантии');
      }
      const employee = await this.prisma.employee.findFirst({
        where: { personId: payerPersonId, firedAt: null, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!employee) {
        throw new BadRequestException(
          'Плательщик гарантии должен быть действующим сотрудником',
        );
      }
    }
  }

  /**
   * Разрешает плательщика гарантии для работы/запчасти. Подрядная работа —
   * плательщик всегда ORGANIZATION (форсируется автоматически). Иначе выбор
   * обязателен при warranty=true.
   */
  private async resolveWarrantyPayer(
    ctx: AuthContext,
    params: {
      warranty: boolean;
      isContractorWork?: boolean;
      payerKind?: WarrantyPayerKind | null;
      payerPersonId?: string | null;
      subject: string;
    },
  ): Promise<{
    warrantyPayerKind: WarrantyPayerKind | null;
    warrantyPayerPersonId: string | null;
  }> {
    if (!params.warranty) {
      return { warrantyPayerKind: null, warrantyPayerPersonId: null };
    }
    if (params.isContractorWork) {
      return { warrantyPayerKind: WarrantyPayerKind.ORGANIZATION, warrantyPayerPersonId: null };
    }
    await this.validatePayerSelection(
      ctx,
      params.payerKind,
      params.payerPersonId,
      params.subject,
    );
    const kind = params.payerKind!;
    return {
      warrantyPayerKind: kind,
      warrantyPayerPersonId:
        kind === WarrantyPayerKind.EMPLOYEE ? (params.payerPersonId ?? null) : null,
    };
  }

  async createService(
    ctx: AuthContext,
    input: CreateOrderItemServiceInput,
  ): Promise<OrderItemModel> {
    const { tenantId, userId } = ctx;
    await this.orderService.validateOrderEditable(ctx, input.orderId);
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    const priceData = input.price
      ? applyDefaultCurrency(input.price, defaultCurrency)
      : { amountMinor: 0n, currencyCode: defaultCurrency };
    const discountData = input.discount
      ? applyDefaultCurrency(input.discount, defaultCurrency)
      : { amountMinor: 0n, currencyCode: defaultCurrency };

    const kind = input.kind ?? OrderItemServiceKind.AUTOSERVICE;
    await this.validateServiceKind(ctx, kind, {
      kind: input.executor?.kind ?? null,
      id: input.executor?.id ?? null,
    });
    const costData = input.cost
      ? applyDefaultCurrency(input.cost, defaultCurrency)
      : null;
    this.validateServiceCost(
      kind,
      costData?.amountMinor ?? null,
      input.costWalletId ?? null,
    );

    const warranty = input.warranty ?? false;
    const payer = await this.resolveWarrantyPayer(ctx, {
      warranty,
      isContractorWork: isContractorService({
        kind,
        executorKind: input.executor?.kind ?? null,
        executorId: input.executor?.id ?? null,
      }),
      payerKind: input.warrantyPayerKind ?? null,
      payerPersonId: input.warrantyPayerPersonId ?? null,
      subject: 'работы',
    });

    const orderItem = await this.prisma.$transaction(async (tx) => {
      const created = await tx.orderItem.create({
        data: {
          id: uuidv6(),
          orderId: input.orderId,
          parentId: input.parentId,
          type: '1',
          tenantId,
          service: {
            create: {
              service: input.service,
              kind,
              ...executorToDb(input.executor),
              warranty,
              warrantyPayerKind: payer.warrantyPayerKind,
              warrantyPayerPersonId: payer.warrantyPayerPersonId,
              priceAmount: priceData.amountMinor,
              priceCurrencyCode: priceData.currencyCode,
              discountAmount: discountData.amountMinor,
              discountCurrencyCode: discountData.currencyCode,
              costAmount: costData?.amountMinor ?? null,
              costCurrencyCode: costData?.currencyCode ?? null,
              costWalletId: input.costWalletId ?? null,
              createdBy: userId,
            },
          },
        },
        include: { service: true },
      });

      await this.auditLog.record(tx, ctx, {
        rootEntityType: AuditEntityType.ORDER,
        rootEntityId: input.orderId,
        entityType: AuditEntityType.ORDER_ITEM_SERVICE,
        entityId: created.id,
        action: AuditAction.CREATE,
        after: { ...created.service, parentId: created.parentId },
        entityDisplayName: created.service?.service ?? null,
      });

      await this.walletTransactionService.syncContractorPayout(tx, ctx, {
        serviceId: created.id,
        orderId: input.orderId,
        serviceName: created.service!.service,
        kind: created.service!.kind,
        executorKind: created.service!.executorKind,
        executorId: created.service!.executorId,
        costAmount: created.service!.costAmount,
        costCurrencyCode: created.service!.costCurrencyCode,
        costWalletId: created.service!.costWalletId,
        warranty: created.service!.warranty,
      });

      return created;
    });

    return this.toModel(orderItem as any);
  }

  async createPart(
    ctx: AuthContext,
    input: CreateOrderItemPartInput,
  ): Promise<OrderItemModel> {
    const { tenantId, userId } = ctx;
    await this.orderService.validateOrderEditable(ctx, input.orderId);

    const part = await this.prisma.part.findUnique({
      where: { id: input.partId },
    });
    if (!part) {
      throw new NotFoundException(`Запчасть с ID ${input.partId} не найдена`);
    }

    if (input.supplierId) {
      const supplier = await this.prisma.organization.findUnique({
        where: { id: input.supplierId },
      });
      if (!supplier) {
        throw new NotFoundException(
          `Поставщик с ID ${input.supplierId} не найден`,
        );
      }
    }

    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    const priceData = input.price
      ? applyDefaultCurrency(input.price, defaultCurrency)
      : { amountMinor: 0n, currencyCode: defaultCurrency };
    const discountData = input.discount
      ? applyDefaultCurrency(input.discount, defaultCurrency)
      : { amountMinor: 0n, currencyCode: defaultCurrency };

    const warranty = input.warranty ?? false;
    const payer = await this.resolveWarrantyPayer(ctx, {
      warranty,
      payerKind: input.warrantyPayerKind ?? null,
      payerPersonId: input.warrantyPayerPersonId ?? null,
      subject: 'запчасти',
    });

    const orderItem = await this.prisma.orderItem.create({
      data: {
        id: uuidv6(),
        orderId: input.orderId,
        parentId: input.parentId,
        type: '2',
        tenantId,
        part: {
          create: {
            partId: input.partId,
            supplierId: input.supplierId,
            quantity: input.quantity,
            warranty,
            warrantyPayerKind: payer.warrantyPayerKind,
            warrantyPayerPersonId: payer.warrantyPayerPersonId,
            priceAmount: priceData.amountMinor,
            priceCurrencyCode: priceData.currencyCode,
            discountAmount: discountData.amountMinor,
            discountCurrencyCode: discountData.currencyCode,
            createdBy: userId,
          },
        },
      },
      include: {
        part: {
          include: {
            part: {
              include: {
                manufacturer: true,
              },
            },
            supplier: true,
          },
        },
      },
    });

    await this.auditLog.record(this.prisma, ctx, {
      rootEntityType: AuditEntityType.ORDER,
      rootEntityId: input.orderId,
      entityType: AuditEntityType.ORDER_ITEM_PART,
      entityId: orderItem.id,
      action: AuditAction.CREATE,
      after: { ...orderItem.part, parentId: orderItem.parentId },
      entityDisplayName: orderItem.part?.part?.name ?? null,
    });

    if (orderItem.part && input.quantity > 0) {
      try {
        await this.reservationService.reserve(ctx, {
          orderItemPartId: orderItem.part.id,
          quantity: input.quantity,
          tenantId,
        });
      } catch {
        // no-op
      }
    }

    return this.toModel(orderItem as any);
  }

  async createPartsForService(
    ctx: AuthContext,
    input: {
      orderId: string;
      parentId: string;
      parts: {
        partId: string;
        quantity: number;
        priceAmount?: bigint | null;
      }[];
      validateOrderEditable?: boolean;
    },
    prismaClient?: Prisma.TransactionClient,
  ): Promise<{ orderItemPartId: string; quantity: number }[]> {
    const { tenantId, userId } = ctx;
    if (input.validateOrderEditable !== false) {
      await this.orderService.validateOrderEditable(ctx, input.orderId);
    }

    if (input.parts.length === 0) {
      return [];
    }

    const client = prismaClient ?? this.prisma;
    const partIds = Array.from(new Set(input.parts.map((part) => part.partId)));

    const existing = await client.part.findMany({
      where: { id: { in: partIds } },
      select: { id: true },
    });

    if (existing.length !== partIds.length) {
      const existingIds = new Set(existing.map((part) => part.id));
      const missingId = partIds.find((id) => !existingIds.has(id));
      throw new NotFoundException(`Запчасть с ID ${missingId} не найдена`);
    }

    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    const orderItemsData: Prisma.OrderItemCreateManyInput[] = [];
    const orderItemPartsData: Prisma.OrderItemPartCreateManyInput[] = [];
    const result: { orderItemPartId: string; quantity: number }[] = [];

    for (const part of input.parts) {
      const orderItemPartId = uuidv6();
      const priceAmount = normalizeMoneyAmount(part.priceAmount ?? null);

      orderItemsData.push({
        id: orderItemPartId,
        orderId: input.orderId,
        parentId: input.parentId,
        type: '2',
        tenantId,
      });

      orderItemPartsData.push({
        id: orderItemPartId,
        partId: part.partId,
        supplierId: null,
        quantity: part.quantity,
        warranty: false,
        priceAmount,
        priceCurrencyCode: defaultCurrency,
        discountAmount: normalizeMoneyAmount(undefined),
        discountCurrencyCode: defaultCurrency,
        createdBy: userId,
      });

      result.push({ orderItemPartId, quantity: part.quantity });
    }

    await client.orderItem.createMany({ data: orderItemsData });
    await client.orderItemPart.createMany({ data: orderItemPartsData });

    return result;
  }

  async reservePartsBestEffort(
    ctx: AuthContext,
    parts: { orderItemPartId: string; quantity: number }[],
  ): Promise<void> {
    for (const part of parts) {
      if (part.quantity <= 0) continue;
      try {
        await this.reservationService.reserve(ctx, {
          orderItemPartId: part.orderItemPartId,
          quantity: part.quantity,
          tenantId: ctx.tenantId,
        });
      } catch {
        // no-op
      }
    }
  }

  async updatePart(
    ctx: AuthContext,
    input: UpdateOrderItemPartInput,
  ): Promise<OrderItemModel> {
    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: input.id },
      include: { part: true },
    });

    if (!orderItem) {
      throw new NotFoundException(`Элемент заказа с ID ${input.id} не найден`);
    }

    if (!orderItem.part) {
      throw new NotFoundException(
        `Элемент заказа с ID ${input.id} не является запчастью`,
      );
    }

    await this.orderService.validateOrderEditable(ctx, orderItem.orderId!);

    const isPartChanged =
      input.partId !== undefined && input.partId !== orderItem.part.partId;
    const isQuantityChanged =
      input.quantity !== undefined &&
      input.quantity !== orderItem.part.quantity;

    // При замене запчасти или изменении количества пересобираем резерв:
    // сначала снимаем старый, затем после апдейта пытаемся поставить новый.
    const shouldRebuildReservation = isPartChanged || isQuantityChanged;

    if (isPartChanged) {
      const part = await this.prisma.part.findUnique({
        where: { id: input.partId },
        select: { id: true },
      });
      if (!part) {
        throw new NotFoundException(`Запчасть с ID ${input.partId} не найдена`);
      }
    }

    if (shouldRebuildReservation) {
      await this.reservationService.releaseAll(orderItem.part.id);
    }

    // Обновляем только переданные поля
    const updateData: any = {};
    if (input.partId !== undefined) updateData.partId = input.partId;
    if (input.quantity !== undefined) updateData.quantity = input.quantity;
    if (input.price !== undefined) {
      const defaultCurrency =
        await this.settingsService.getDefaultCurrencyCode();
      const priceData =
        input.price != null
          ? applyDefaultCurrency(input.price, defaultCurrency)
          : { amountMinor: 0n, currencyCode: defaultCurrency };
      updateData.priceAmount = priceData.amountMinor;
      updateData.priceCurrencyCode = priceData.currencyCode;
    }
    if (input.discount !== undefined) {
      const defaultCurrency =
        await this.settingsService.getDefaultCurrencyCode();
      const discountData =
        input.discount != null
          ? applyDefaultCurrency(input.discount, defaultCurrency)
          : { amountMinor: 0n, currencyCode: defaultCurrency };
      updateData.discountAmount = discountData.amountMinor;
      updateData.discountCurrencyCode = discountData.currencyCode;
    }
    if (input.warranty != null) updateData.warranty = input.warranty;

    const warrantyRelevant =
      input.warranty != null ||
      input.warrantyPayerKind !== undefined ||
      input.warrantyPayerPersonId !== undefined;
    if (warrantyRelevant) {
      const payer = await this.resolveWarrantyPayer(ctx, {
        warranty: input.warranty ?? orderItem.part.warranty,
        payerKind:
          input.warrantyPayerKind !== undefined
            ? input.warrantyPayerKind
            : (orderItem.part.warrantyPayerKind as WarrantyPayerKind | null),
        payerPersonId:
          input.warrantyPayerPersonId !== undefined
            ? input.warrantyPayerPersonId
            : orderItem.part.warrantyPayerPersonId,
        subject: 'запчасти',
      });
      updateData.warrantyPayerKind = payer.warrantyPayerKind;
      updateData.warrantyPayerPersonId = payer.warrantyPayerPersonId;
    }
    if (input.supplierId !== undefined)
      updateData.supplierId = input.supplierId;
    if (input.parentId !== undefined) {
      await this.prisma.orderItem.update({
        where: { id: input.id },
        data: { parentId: input.parentId },
      });
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.orderItemPart.update({
        where: { id: orderItem.part.id },
        data: updateData,
      });
    }

    if (shouldRebuildReservation) {
      const nextQuantity = input.quantity ?? orderItem.part.quantity;
      if (nextQuantity > 0) {
        try {
          await this.reservationService.reserve(ctx, {
            orderItemPartId: orderItem.part.id,
            quantity: nextQuantity,
            tenantId: orderItem.tenantId,
          });
        } catch {
          // no-op
        }
      }
    }

    const updated = await this.prisma.orderItem.findUnique({
      where: { id: input.id },
      include: {
        group: true,
        service: true,
        part: {
          include: {
            part: {
              include: {
                manufacturer: true,
              },
            },
            supplier: true,
          },
        },
      },
    });

    await this.auditLog.record(this.prisma, ctx, {
      rootEntityType: AuditEntityType.ORDER,
      rootEntityId: orderItem.orderId!,
      entityType: AuditEntityType.ORDER_ITEM_PART,
      entityId: input.id,
      action: AuditAction.UPDATE,
      before: { ...orderItem.part, parentId: orderItem.parentId },
      after: { ...updated?.part, parentId: updated?.parentId },
      entityDisplayName: updated?.part?.part?.name ?? null,
    });

    return this.toModel(updated as any);
  }

  async updateService(
    ctx: AuthContext,
    input: UpdateOrderItemServiceInput,
  ): Promise<OrderItemModel> {
    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: input.id },
      include: { service: true },
    });

    if (!orderItem) {
      throw new NotFoundException(`Элемент заказа с ID ${input.id} не найден`);
    }

    if (!orderItem.service) {
      throw new NotFoundException(
        `Элемент заказа с ID ${input.id} не является услугой`,
      );
    }

    await this.orderService.validateOrderEditable(ctx, orderItem.orderId!);

    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();

    // Обновляем только переданные поля
    const updateData: any = {};
    if (input.service !== undefined) updateData.service = input.service;
    if (input.kind != null) updateData.kind = input.kind;
    if (input.price !== undefined) {
      const priceData =
        input.price != null
          ? applyDefaultCurrency(input.price, defaultCurrency)
          : { amountMinor: 0n, currencyCode: defaultCurrency };
      updateData.priceAmount = priceData.amountMinor;
      updateData.priceCurrencyCode = priceData.currencyCode;
    }
    if (input.discount !== undefined) {
      const discountData =
        input.discount != null
          ? applyDefaultCurrency(input.discount, defaultCurrency)
          : { amountMinor: 0n, currencyCode: defaultCurrency };
      updateData.discountAmount = discountData.amountMinor;
      updateData.discountCurrencyCode = discountData.currencyCode;
    }
    if (input.warranty != null) updateData.warranty = input.warranty;
    if (input.executor !== undefined) {
      Object.assign(updateData, executorToDb(input.executor));
    }
    if (input.cost !== undefined) {
      if (input.cost != null) {
        const costData = applyDefaultCurrency(input.cost, defaultCurrency);
        updateData.costAmount = costData.amountMinor;
        updateData.costCurrencyCode = costData.currencyCode;
      } else {
        updateData.costAmount = null;
        updateData.costCurrencyCode = null;
      }
    }
    if (input.costWalletId !== undefined) {
      updateData.costWalletId = input.costWalletId;
    }

    // Итоговое состояние после применения апдейта — для валидации и синка проводки
    const effective = { ...orderItem.service, ...updateData };

    // Перевод в свою работу обнуляет себестоимость (проводка удалится в синке)
    if (effective.kind !== OrderItemServiceKind.CONTRACTOR) {
      if (effective.costAmount != null || effective.costWalletId != null) {
        updateData.costAmount = null;
        updateData.costCurrencyCode = null;
        updateData.costWalletId = null;
        effective.costAmount = null;
        effective.costCurrencyCode = null;
        effective.costWalletId = null;
      }
    }

    await this.validateServiceKind(ctx, effective.kind, {
      kind: effective.executorKind,
      id: effective.executorId,
    });
    this.validateServiceCost(
      effective.kind,
      effective.costAmount,
      effective.costWalletId,
    );

    const warrantyRelevant =
      input.warranty != null ||
      input.warrantyPayerKind !== undefined ||
      input.warrantyPayerPersonId !== undefined ||
      input.kind != null ||
      input.executor !== undefined;
    if (warrantyRelevant) {
      const payer = await this.resolveWarrantyPayer(ctx, {
        warranty: effective.warranty,
        isContractorWork: isContractorService({
          kind: effective.kind,
          executorKind: effective.executorKind,
          executorId: effective.executorId,
        }),
        payerKind:
          input.warrantyPayerKind !== undefined
            ? input.warrantyPayerKind
            : effective.warrantyPayerKind,
        payerPersonId:
          input.warrantyPayerPersonId !== undefined
            ? input.warrantyPayerPersonId
            : effective.warrantyPayerPersonId,
        subject: 'работы',
      });
      updateData.warrantyPayerKind = payer.warrantyPayerKind;
      updateData.warrantyPayerPersonId = payer.warrantyPayerPersonId;
      effective.warrantyPayerKind = payer.warrantyPayerKind;
      effective.warrantyPayerPersonId = payer.warrantyPayerPersonId;
    }

    if (input.parentId !== undefined) {
      await this.prisma.orderItem.update({
        where: { id: input.id },
        data: { parentId: input.parentId },
      });
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.$transaction(async (tx) => {
        await tx.orderItemService.update({
          where: { id: orderItem.service!.id },
          data: updateData,
        });
        await this.auditLog.record(tx, ctx, {
          rootEntityType: AuditEntityType.ORDER,
          rootEntityId: orderItem.orderId!,
          entityType: AuditEntityType.ORDER_ITEM_SERVICE,
          entityId: input.id,
          action: AuditAction.UPDATE,
          before: { ...orderItem.service, parentId: orderItem.parentId },
          after: {
            ...orderItem.service,
            ...updateData,
            parentId: orderItem.parentId,
          },
          entityDisplayName:
            (updateData as { service?: string }).service ??
            orderItem.service!.service ??
            null,
        });
        await this.walletTransactionService.syncContractorPayout(tx, ctx, {
          serviceId: input.id,
          orderId: orderItem.orderId!,
          serviceName: effective.service,
          kind: effective.kind,
          executorKind: effective.executorKind,
          executorId: effective.executorId,
          costAmount: effective.costAmount,
          costCurrencyCode: effective.costCurrencyCode,
          costWalletId: effective.costWalletId,
          warranty: effective.warranty,
        });
      });
    }

    const updated = await this.prisma.orderItem.findUnique({
      where: { id: input.id },
      include: {
        group: true,
        service: true,
        part: {
          include: {
            part: {
              include: {
                manufacturer: true,
              },
            },
            supplier: true,
          },
        },
      },
    });

    return this.toModel(updated as any);
  }

  async delete(
    ctx: AuthContext,
    id: string,
    deleteChildren: boolean = true,
    options?: {
      tx?: Prisma.TransactionClient;
      skipValidation?: boolean;
      skipAudit?: boolean;
    },
  ): Promise<OrderItemModel> {
    const client = options?.tx ?? this.prisma;

    const orderItem = await client.orderItem.findUnique({
      where: { id },
      include: {
        part: true,
        service: true,
        group: true,
      },
    });

    if (!orderItem) {
      throw new NotFoundException(`Элемент заказа с ID ${id} не найден`);
    }

    if (!options?.skipValidation) {
      await this.orderService.validateOrderEditable(ctx, orderItem.orderId!);
    }

    // Снимаем резерв если это запчасть (best-effort, вне транзакции)
    if (orderItem.part) {
      await this.reservationService.releaseAll(orderItem.part.id);
    }

    // Собираем работы (сама позиция + потомки при каскадном удалении),
    // чтобы удалить их проводки оплаты подрядчику вместе с позициями.
    const affectedServiceIds: string[] = [];
    if (orderItem.service) affectedServiceIds.push(orderItem.id);

    // Обрабатываем дочерние элементы
    if (!deleteChildren) {
      // Перемещаем дочерние элементы в корень (parentId = null)
      await client.orderItem.updateMany({
        where: { parentId: id },
        data: { parentId: null },
      });
    } else {
      // Удаляем дочерние элементы вместе с их резервациями
      const childParts = await client.orderItem.findMany({
        where: { parentId: id },
        include: { part: true, service: { select: { id: true } } },
      });

      // Рекурсивно удаляем резервации для всех дочерних запчастей
      for (const child of childParts) {
        if (child.part) {
          await this.reservationService.releaseAll(child.part.id);
        }
        if (child.service) {
          affectedServiceIds.push(child.id);
        }
        // Рекурсивно обрабатываем внуков
        await this.deleteChildReservations(child.id, client, affectedServiceIds);
      }
    }

    const performDelete = async (tx: Prisma.TransactionClient) => {
      if (orderItem.orderId && affectedServiceIds.length > 0) {
        await this.walletTransactionService.removeContractorPayouts(
          tx,
          ctx,
          orderItem.orderId,
          affectedServiceIds,
        );
      }
      return tx.orderItem.delete({
        where: { id },
        include: {
          group: true,
          service: true,
          part: {
            include: {
              part: {
                include: {
                  manufacturer: true,
                },
              },
              supplier: true,
            },
          },
        },
      });
    };

    const deleted = options?.tx
      ? await performDelete(options.tx)
      : await this.prisma.$transaction(performDelete);

    if (orderItem.orderId && !options?.skipAudit) {
      const entityType = orderItem.group
        ? AuditEntityType.ORDER_ITEM_GROUP
        : orderItem.service
          ? AuditEntityType.ORDER_ITEM_SERVICE
          : AuditEntityType.ORDER_ITEM_PART;
      const before = orderItem.group
        ? { ...orderItem.group, parentId: orderItem.parentId }
        : orderItem.service
          ? { ...orderItem.service, parentId: orderItem.parentId }
          : { ...orderItem.part, parentId: orderItem.parentId };
      const displayName =
        orderItem.group?.name ??
        orderItem.service?.service ??
        (deleted as any)?.part?.part?.name ??
        null;
      await this.auditLog.record(client, ctx, {
        rootEntityType: AuditEntityType.ORDER,
        rootEntityId: orderItem.orderId,
        entityType,
        entityId: id,
        action: AuditAction.DELETE,
        before,
        entityDisplayName: displayName,
      });
    }

    return this.toModel(deleted as any);
  }

  /**
   * Batch-применение гарантии к выделенным позициям (одно модальное окно
   * вместо тумблера на каждую строку). Плательщик здесь НЕ выбирается —
   * только флаг warranty и причина (Note); для подрядных работ плательщик
   * всегда форсируется в ORGANIZATION, для остальных позиций плательщик
   * назначается отдельно по каждой позиции (см. updateService/updatePart,
   * warrantyPayerKind/warrantyPayerPersonId) — это исключает путаницу, когда
   * один batch-выбор в диалоге неявно применялся бы к разным позициям с
   * разными фактическими плательщиками. В одной транзакции: обновление
   * warranty/warrantyPayerKind на работах и запчастях, синк ContractorPayout,
   * создание заметки с причиной (только при warranty=true), аудит по каждой позиции.
   */
  async applyWarranty(
    ctx: AuthContext,
    input: ApplyOrderWarrantyInput,
  ): Promise<ApplyOrderWarrantyPayload> {
    await this.orderService.validateOrderEditable(ctx, input.orderId);

    if (input.itemIds.length === 0) {
      throw new BadRequestException('Не выбрано ни одной позиции');
    }

    const reason = input.reason?.trim() ?? '';
    if (input.warranty && !reason) {
      throw new BadRequestException('Укажите причину гарантии');
    }

    const allOrderItems = await this.prisma.orderItem.findMany({
      where: { orderId: input.orderId },
      select: {
        id: true,
        parentId: true,
        type: true,
        service: {
          select: { kind: true, executorKind: true, executorId: true },
        },
      },
    });

    const expandedItemIds = expandWarrantyItemIds(input.itemIds, allOrderItems);

    const items = await this.prisma.orderItem.findMany({
      where: { id: { in: expandedItemIds }, orderId: input.orderId },
      include: {
        service: true,
        part: { include: { part: true } },
      },
    });

    const requestedItems = items.filter((item) => input.itemIds.includes(item.id));
    if (requestedItems.length === 0) {
      throw new NotFoundException('Позиции не найдены');
    }

    const serviceItems = items.filter(
      (item): item is typeof item & { service: NonNullable<(typeof item)['service']> } =>
        item.service != null,
    );
    const partItems = items.filter(
      (item): item is typeof item & { part: NonNullable<(typeof item)['part']> } =>
        item.part != null,
    );

    let noteId: string | null = null;

    await this.prisma.$transaction(async (tx) => {
      for (const item of serviceItems) {
        const before = item.service;
        // Плательщик подрядной работы фиксирован (ORGANIZATION); для своих
        // работ payer сбрасывается — назначается позже отдельно по позиции.
        const warrantyPayerKind =
          input.warranty && isContractorService(before)
            ? WarrantyPayerKind.ORGANIZATION
            : null;
        const warrantyPayerPersonId = null;

        await tx.orderItemService.update({
          where: { id: item.id },
          data: { warranty: input.warranty, warrantyPayerKind, warrantyPayerPersonId },
        });

        await this.auditLog.record(tx, ctx, {
          rootEntityType: AuditEntityType.ORDER,
          rootEntityId: input.orderId,
          entityType: AuditEntityType.ORDER_ITEM_SERVICE,
          entityId: item.id,
          action: AuditAction.UPDATE,
          before: { ...before, parentId: item.parentId },
          after: {
            ...before,
            warranty: input.warranty,
            warrantyPayerKind,
            warrantyPayerPersonId,
            parentId: item.parentId,
          },
          entityDisplayName: before.service,
        });

        await this.walletTransactionService.syncContractorPayout(tx, ctx, {
          serviceId: item.id,
          orderId: input.orderId,
          serviceName: before.service,
          kind: before.kind,
          executorKind: before.executorKind,
          executorId: before.executorId,
          costAmount: before.costAmount,
          costCurrencyCode: before.costCurrencyCode,
          costWalletId: before.costWalletId,
          warranty: input.warranty,
        });
      }

      for (const item of partItems) {
        const before = item.part;
        // Плательщик запчасти сбрасывается — назначается позже отдельно по позиции.
        const warrantyPayerKind = null;
        const warrantyPayerPersonId = null;

        await tx.orderItemPart.update({
          where: { id: item.id },
          data: { warranty: input.warranty, warrantyPayerKind, warrantyPayerPersonId },
        });

        await this.auditLog.record(tx, ctx, {
          rootEntityType: AuditEntityType.ORDER,
          rootEntityId: input.orderId,
          entityType: AuditEntityType.ORDER_ITEM_PART,
          entityId: item.id,
          action: AuditAction.UPDATE,
          before: { ...before, parentId: item.parentId },
          after: {
            ...before,
            warranty: input.warranty,
            warrantyPayerKind,
            warrantyPayerPersonId,
            parentId: item.parentId,
          },
          entityDisplayName: before.part?.name ?? null,
        });
      }

      if (input.warranty) {
        const note = await this.noteService.createWarrantyNote(ctx, tx, input.orderId, reason);
        noteId = note.id;
      }
    });

    return {
      orderId: input.orderId,
      updatedCount: serviceItems.length + partItems.length,
      noteId,
    };
  }

  /**
   * Рекурсивно удаляет резервации для всех дочерних запчастей.
   * Попутно собирает id дочерних работ (для очистки проводок подрядчику).
   */
  private async deleteChildReservations(
    parentId: string,
    client?: Prisma.TransactionClient | PrismaService,
    serviceIdsAccumulator?: string[],
  ): Promise<void> {
    const prismaClient = client ?? this.prisma;
    const children = await prismaClient.orderItem.findMany({
      where: { parentId },
      include: { part: true, service: { select: { id: true } } },
    });

    for (const child of children) {
      if (child.part) {
        await this.reservationService.releaseAll(child.part.id);
      }
      if (child.service && serviceIdsAccumulator) {
        serviceIdsAccumulator.push(child.id);
      }
      await this.deleteChildReservations(
        child.id,
        prismaClient,
        serviceIdsAccumulator,
      );
    }
  }
}
