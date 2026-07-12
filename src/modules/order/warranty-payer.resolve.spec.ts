import { PartyKind } from 'src/common/party';
import { OrderItemServiceKind } from './enums/order-item-service-kind.enum';
import { WarrantyPayer } from './enums/warranty-payer.enum';
import {
  expandWarrantyItemIds,
  findAncestorService,
  resolvePartWarrantyChargePersonId,
  resolvePartWarrantyPayer,
  resolveServiceWarrantyPayer,
  type WarrantyOrderItemNode,
} from './warranty-payer.resolve';

describe('warranty-payer.resolve', () => {
  const autoservicePerson = {
    kind: OrderItemServiceKind.AUTOSERVICE,
    executorKind: PartyKind.PERSON,
    executorId: 'person-1',
  };
  const contractor = {
    kind: OrderItemServiceKind.CONTRACTOR,
    executorKind: PartyKind.ORGANIZATION,
    executorId: 'org-1',
  };

  describe('resolveServiceWarrantyPayer', () => {
    it('1. сотрудник → EXECUTOR', () => {
      expect(resolveServiceWarrantyPayer(autoservicePerson, WarrantyPayer.EXECUTOR)).toBe(
        WarrantyPayer.EXECUTOR,
      );
    });

    it('2. подрядчик → ORGANIZATION', () => {
      expect(resolveServiceWarrantyPayer(contractor, WarrantyPayer.EXECUTOR)).toBe(
        WarrantyPayer.ORGANIZATION,
      );
    });

    it('ORGANIZATION остаётся ORGANIZATION', () => {
      expect(
        resolveServiceWarrantyPayer(autoservicePerson, WarrantyPayer.ORGANIZATION),
      ).toBe(WarrantyPayer.ORGANIZATION);
    });
  });

  describe('resolvePartWarrantyPayer', () => {
    it('3. родитель-сотрудник → EXECUTOR', () => {
      expect(
        resolvePartWarrantyPayer(autoservicePerson, null, WarrantyPayer.EXECUTOR),
      ).toBe(WarrantyPayer.EXECUTOR);
    });

    it('4. без родителя, есть ответственный → EXECUTOR', () => {
      expect(resolvePartWarrantyPayer(null, 'person-2', WarrantyPayer.EXECUTOR)).toBe(
        WarrantyPayer.EXECUTOR,
      );
    });

    it('5. без родителя, нет ответственного → ORGANIZATION', () => {
      expect(resolvePartWarrantyPayer(null, null, WarrantyPayer.EXECUTOR)).toBe(
        WarrantyPayer.ORGANIZATION,
      );
    });

    it('6. родитель-подрядчик → ORGANIZATION', () => {
      expect(resolvePartWarrantyPayer(contractor, 'person-2', WarrantyPayer.EXECUTOR)).toBe(
        WarrantyPayer.ORGANIZATION,
      );
    });
  });

  describe('resolvePartWarrantyChargePersonId', () => {
    it('возвращает исполнителя родителя или ответственного', () => {
      expect(resolvePartWarrantyChargePersonId(autoservicePerson, null)).toBe('person-1');
      expect(resolvePartWarrantyChargePersonId(null, 'person-2')).toBe('person-2');
      expect(resolvePartWarrantyChargePersonId(contractor, 'person-2')).toBeNull();
      expect(resolvePartWarrantyChargePersonId(null, null)).toBeNull();
    });
  });

  describe('expandWarrantyItemIds', () => {
    it('добавляет запчасти под выбранной работой через группу', () => {
      const ids = expandWarrantyItemIds(['group-1'], [
        { id: 'group-1', parentId: null, type: '3' },
        { id: 'svc-1', parentId: 'group-1', type: '1' },
        { id: 'part-1', parentId: 'svc-1', type: '2' },
      ]);
      expect(ids).toEqual(['group-1', 'part-1']);
    });
  });

  describe('findAncestorService', () => {
    it('находит работу через группу', () => {
      const items = new Map<string, WarrantyOrderItemNode>([
        ['group-1', { parentId: 'svc-1', service: null }],
        ['svc-1', { parentId: null, service: autoservicePerson }],
      ]);
      expect(findAncestorService('group-1', items)).toEqual(autoservicePerson);
    });
  });
});
