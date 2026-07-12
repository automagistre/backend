import { PartyKind } from 'src/common/party';
import { OrderItemServiceKind } from './enums/order-item-service-kind.enum';
import { WarrantyPayer } from './enums/warranty-payer.enum';

/** Контекст работы для разрешения плательщика по гарантии. */
export type WarrantyServiceContext = {
  kind: string | null;
  executorKind: string | null;
  executorId: string | null;
};

/** Элемент дерева заказа для поиска родительской работы. */
export type WarrantyOrderItemNode = {
  parentId: string | null;
  service: WarrantyServiceContext | null;
};

export function isContractorService(service: WarrantyServiceContext): boolean {
  return (
    service.kind === OrderItemServiceKind.CONTRACTOR ||
    service.executorKind === PartyKind.ORGANIZATION
  );
}

/**
 * Плательщик по гарантийной работе при выборе «механик» (EXECUTOR):
 * 1. Сотрудник-исполнитель → EXECUTOR
 * 2. Подрядчик → ORGANIZATION
 */
export function resolveServiceWarrantyPayer(
  service: WarrantyServiceContext,
  selected: WarrantyPayer | null | undefined,
): WarrantyPayer | null {
  if (!selected) return null;
  if (selected === WarrantyPayer.ORGANIZATION) return WarrantyPayer.ORGANIZATION;
  if (isContractorService(service)) return WarrantyPayer.ORGANIZATION;
  return WarrantyPayer.EXECUTOR;
}

/**
 * Плательщик по гарантийной запчасти при выборе «механик» (EXECUTOR):
 * 3. Родитель-сотрудник → EXECUTOR
 * 4. Без родителя-работы, есть ответственный → EXECUTOR
 * 5. Без родителя-работы, нет ответственного → ORGANIZATION
 * 6. Родитель-подрядчик → ORGANIZATION
 */
export function resolvePartWarrantyPayer(
  ancestorService: WarrantyServiceContext | null | undefined,
  assigneeId: string | null | undefined,
  selected: WarrantyPayer | null | undefined,
): WarrantyPayer | null {
  if (!selected) return null;
  if (selected === WarrantyPayer.ORGANIZATION) return WarrantyPayer.ORGANIZATION;
  if (ancestorService && isContractorService(ancestorService)) {
    return WarrantyPayer.ORGANIZATION;
  }
  if (
    ancestorService?.executorKind === PartyKind.PERSON &&
    ancestorService.executorId
  ) {
    return WarrantyPayer.EXECUTOR;
  }
  if (assigneeId) return WarrantyPayer.EXECUTOR;
  return WarrantyPayer.ORGANIZATION;
}

/** Сотрудник, с которого удерживают запчасть (null → платит организация). */
export function resolvePartWarrantyChargePersonId(
  ancestorService: WarrantyServiceContext | null | undefined,
  assigneeId: string | null | undefined,
): string | null {
  if (ancestorService && isContractorService(ancestorService)) return null;
  if (
    ancestorService?.executorKind === PartyKind.PERSON &&
    ancestorService.executorId
  ) {
    return ancestorService.executorId;
  }
  return assigneeId ?? null;
}

/** Ближайшая родительская работа (через группы). */
export function findAncestorService(
  startParentId: string | null | undefined,
  itemsById: ReadonlyMap<string, WarrantyOrderItemNode>,
): WarrantyServiceContext | null {
  let currentId = startParentId ?? null;
  while (currentId) {
    const item = itemsById.get(currentId);
    if (!item) break;
    if (item.service) return item.service;
    currentId = item.parentId;
  }
  return null;
}

/** Добавляет дочерние запчасти для выбранных работ/групп (Group → Work → Part). */
export function expandWarrantyItemIds(
  itemIds: readonly string[],
  allItems: ReadonlyArray<{ id: string; parentId: string | null; type: string }>,
): string[] {
  // В БД order_item.type хранится как '1' (работа), '2' (запчасть), '3' (группа).
  const PART_TYPE = '2';
  const itemsById = new Map(allItems.map((item) => [item.id, item]));
  const childrenByParent = new Map<
    string,
    Array<{ id: string; parentId: string | null; type: string }>
  >();
  for (const item of allItems) {
    if (!item.parentId) continue;
    const siblings = childrenByParent.get(item.parentId) ?? [];
    siblings.push(item);
    childrenByParent.set(item.parentId, siblings);
  }

  const expanded = new Set(itemIds);
  const collectPartIds = (parentId: string): void => {
    for (const child of childrenByParent.get(parentId) ?? []) {
      if (child.type === PART_TYPE) expanded.add(child.id);
      collectPartIds(child.id);
    }
  };

  for (const id of itemIds) {
    const item = itemsById.get(id);
    if (item && item.type !== PART_TYPE) collectPartIds(id);
  }

  return [...expanded];
}
