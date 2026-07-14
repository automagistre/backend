import { PartyKind } from 'src/common/party';
import { OrderItemServiceKind } from './enums/order-item-service-kind.enum';
import { expandWarrantyItemIds, isContractorService } from './warranty-payer.resolve';

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

  describe('isContractorService', () => {
    it('kind=CONTRACTOR → true', () => {
      expect(isContractorService(contractor)).toBe(true);
    });

    it('executorKind=ORGANIZATION → true даже при kind=AUTOSERVICE', () => {
      expect(
        isContractorService({
          kind: OrderItemServiceKind.AUTOSERVICE,
          executorKind: PartyKind.ORGANIZATION,
          executorId: 'org-1',
        }),
      ).toBe(true);
    });

    it('своя работа с сотрудником → false', () => {
      expect(isContractorService(autoservicePerson)).toBe(false);
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
});
