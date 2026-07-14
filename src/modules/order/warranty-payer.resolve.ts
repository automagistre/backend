import { PartyKind } from 'src/common/party';
import { OrderItemServiceKind } from './enums/order-item-service-kind.enum';

/** Контекст работы для проверки вида (своя/подрядная). */
export type WarrantyServiceContext = {
  kind: string | null;
  executorKind: string | null;
  executorId: string | null;
};

/** Подрядная работа: либо kind=CONTRACTOR, либо исполнитель — организация. */
export function isContractorService(service: WarrantyServiceContext): boolean {
  return (
    service.kind === OrderItemServiceKind.CONTRACTOR ||
    service.executorKind === PartyKind.ORGANIZATION
  );
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
