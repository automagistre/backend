import { mockDeep } from 'jest-mock-extended';
import { AuditLogService } from './audit-log.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { DisplayContextService } from 'src/modules/display-context/display-context.service';
import { AuditAction } from './enums/audit.enums';

describe('AuditLogService (чистые помощники)', () => {
  let service: AuditLogService;
  let s: any;

  beforeEach(() => {
    service = new AuditLogService(
      mockDeep<PrismaService>() as unknown as PrismaService,
      mockDeep<DisplayContextService>() as unknown as DisplayContextService,
    );
    s = service as any;
  });

  describe('inferAction', () => {
    it('CREATE / DELETE / UPDATE по наличию before/after', () => {
      expect(s.inferAction(null, {})).toBe(AuditAction.CREATE);
      expect(s.inferAction({}, null)).toBe(AuditAction.DELETE);
      expect(s.inferAction({}, {})).toBe(AuditAction.UPDATE);
    });
  });

  describe('serialize', () => {
    it('money: BigInt → строка amountMinor + валюта из currencyField строки', () => {
      const res = s.serialize({ kind: 'money', currencyField: 'cc' }, 1500n, {
        cc: 'RUB',
      });
      expect(res).toEqual({ amountMinor: '1500', currencyCode: 'RUB' });
    });

    it('null/undefined → null', () => {
      expect(s.serialize({ kind: 'scalar' }, null, {})).toBeNull();
      expect(s.serialize({ kind: 'scalar' }, undefined, {})).toBeNull();
    });

    it('bool приводит к Boolean', () => {
      expect(s.serialize({ kind: 'bool' }, 1, {})).toBe(true);
      expect(s.serialize({ kind: 'bool' }, 0, {})).toBe(false);
    });

    it('date: Date → ISO-строка', () => {
      const d = new Date('2026-06-29T00:00:00.000Z');
      expect(s.serialize({ kind: 'date' }, d, {})).toBe(
        '2026-06-29T00:00:00.000Z',
      );
    });

    it('quantity: bigint → number', () => {
      expect(s.serialize({ kind: 'quantity' }, 250n, {})).toBe(250);
    });

    it('scalar: bigint → строка', () => {
      expect(s.serialize({ kind: 'scalar' }, 10n, {})).toBe('10');
    });
  });

  describe('valuesEqual', () => {
    it('сравнивает по структуре', () => {
      expect(s.valuesEqual({ a: 1 }, { a: 1 })).toBe(true);
      expect(s.valuesEqual({ a: 1 }, { a: 2 })).toBe(false);
      expect(s.valuesEqual(null, null)).toBe(true);
    });
  });

  describe('formatChanges', () => {
    it('WARRANTY_DEDUCT: amount на позиции заказа форматируется как money', () => {
      const formatted = s.formatChanges('ORDER_ITEM_SERVICE' as any, [
        {
          field: 'amount',
          oldValue: null,
          newValue: { amountMinor: '-50000', currencyCode: 'RUB' },
        },
      ]);

      expect(formatted[0]).toMatchObject({
        field: 'amount',
        label: 'Сумма удержания',
        kind: 'MONEY',
        oldValue: null,
        newValue: { amountMinor: '-50000', currencyCode: 'RUB' },
      });
    });
  });
});
