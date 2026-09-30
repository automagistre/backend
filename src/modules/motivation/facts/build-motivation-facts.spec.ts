import { ProfitCostBasis } from 'src/modules/profit/enums/profit-cost-basis.enum';
import { calculateMotivation } from '../calculator/motivation-calculator';
import type { MotivationParticipant } from '../calculator/motivation-calculator.types';
import { buildTestScheme } from '../calculator/testing/test-scheme';
import { buildMotivationFacts } from './build-motivation-facts';
import type {
  MotivationEmployee,
  MotivationFactsContext,
  MotivationSourceRow,
} from './motivation-facts.types';

const MASTER = 'pos-master';
const ADMIN = 'pos-admin';
const PARTS = 'pos-parts';

const pair = (
  employeeId: string,
  positionId: string,
): MotivationParticipant => ({ employeeId, positionId });

const at = (dateKey: string) => new Date(`${dateKey}T12:00:00Z`);

const row = (over: Partial<MotivationSourceRow>): MotivationSourceRow => ({
  itemId: 'item-1',
  orderId: 'order-1',
  orderNumber: 100,
  closedAt: at('2026-09-20'),
  kind: 'SERVICE',
  contractor: false,
  label: 'Замена масла',
  profitMinor: 12_000n,
  costBasis: ProfitCostBasis.SALARY,
  warranty: false,
  anchor: { createdAt: at('2026-09-10'), snapshotId: 'snap-item' },
  recommendation: null,
  picker: null,
  ...over,
});

const employees: Record<string, MotivationEmployee> = {
  'user-parts': { employeeId: 'parts-1', positionIds: [PARTS] },
  'user-admin': { employeeId: 'admin-1', positionIds: [ADMIN] },
};

const ctx = (
  over: Partial<MotivationFactsContext> = {},
): MotivationFactsContext => ({
  workDateOf: (date) => date.toISOString().slice(0, 10),
  snapshots: new Map([
    ['snap-item', [pair('master-1', MASTER), pair('admin-1', ADMIN)]],
    ['snap-rec', [pair('admin-2', ADMIN)]],
    ['snap-empty', []],
  ]),
  schedule: new Map([
    ['2026-07-15', [pair('master-2', MASTER), pair('parts-1', PARTS)]],
  ]),
  employeeOf: (userId) => employees[userId] ?? null,
  ...over,
});

const build = (
  rows: MotivationSourceRow[],
  context: MotivationFactsContext = ctx(),
) => buildMotivationFacts(rows, context);

describe('buildMotivationFacts', () => {
  it('гарантия исключается со своей прибылью', () => {
    const facts = build([row({ warranty: true })]);

    expect(facts.items).toEqual([]);
    expect(facts.excluded).toEqual([
      expect.objectContaining({ reason: 'WARRANTY', profitMinor: 12_000n }),
    ]);
  });

  it('снимок позиции важнее графика', () => {
    const [item] = build([row({})]).items;

    expect(item.participants).toEqual({
      'SNAPSHOT:ITEM': [pair('master-1', MASTER), pair('admin-1', ADMIN)],
    });
    expect(item.notApplicable).toEqual(['RECOMMENDATION']);
  });

  it('без снимка — график рабочего дня создания', () => {
    const [item] = build([
      row({ anchor: { createdAt: at('2026-07-15'), snapshotId: null } }),
    ]).items;

    expect(item.participants['SCHEDULE:ITEM']).toEqual([
      pair('master-2', MASTER),
      pair('parts-1', PARTS),
    ]);
  });

  it('день графика без работающих — пустой состав, а не исключение', () => {
    const [item] = build([
      row({ anchor: { createdAt: at('2026-07-16'), snapshotId: null } }),
    ]).items;

    expect(item.participants['SCHEDULE:ITEM']).toEqual([]);
  });

  it('без снимка и раньше графика — исключается', () => {
    const facts = build([
      row({ anchor: { createdAt: at('2026-05-31'), snapshotId: null } }),
      row({ itemId: 'item-2', anchor: { createdAt: null, snapshotId: null } }),
    ]);

    expect(facts.items).toEqual([]);
    expect(facts.excluded.map((item) => item.reason)).toEqual([
      'BEFORE_SCHEDULE',
      'BEFORE_SCHEDULE',
    ]);
  });

  it('пустой снимок — «в смене никого», график не подставляется', () => {
    const [item] = build([
      row({
        anchor: { createdAt: at('2026-07-15'), snapshotId: 'snap-empty' },
      }),
    ]).items;

    expect(item.participants).toEqual({ 'SNAPSHOT:ITEM': [] });
  });

  it('рекомендация: снимок, без снимка — график дня создания, до графика — только применимость', () => {
    const facts = build([
      row({
        recommendation: { createdAt: at('2026-07-15'), snapshotId: 'snap-rec' },
      }),
      row({
        itemId: 'item-2',
        recommendation: { createdAt: at('2026-07-15'), snapshotId: null },
      }),
      row({
        itemId: 'item-3',
        recommendation: { createdAt: at('2026-05-31'), snapshotId: null },
      }),
    ]);

    expect(facts.items[0].participants['SNAPSHOT:RECOMMENDATION']).toEqual([
      pair('admin-2', ADMIN),
    ]);
    expect(
      facts.items[0].participants['SCHEDULE:RECOMMENDATION'],
    ).toBeUndefined();
    expect(facts.items[1].participants['SCHEDULE:RECOMMENDATION']).toEqual([
      pair('master-2', MASTER),
      pair('parts-1', PARTS),
    ]);
    expect(
      facts.items[2].participants['SNAPSHOT:RECOMMENDATION'],
    ).toBeUndefined();
    expect(
      facts.items[2].participants['SCHEDULE:RECOMMENDATION'],
    ).toBeUndefined();
    expect(facts.items.map((item) => item.notApplicable)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('подряд — отдельный тип', () => {
    const [item] = build([row({ contractor: true })]).items;

    expect(item.type).toBe('CONTRACTOR');
  });

  it('хранение — якорь договора, этапа рекомендации нет', () => {
    const [item] = build([
      row({
        kind: 'STORAGE',
        anchor: { createdAt: at('2026-07-15'), snapshotId: null },
      }),
    ]).items;

    expect(item.type).toBe('STORAGE');
    expect(item.participants).toEqual({
      'SCHEDULE:CONTRACT': [pair('master-2', MASTER), pair('parts-1', PARTS)],
    });
    expect(item.notApplicable).toBeUndefined();
  });

  describe('подбор запчасти', () => {
    const part = (over: Partial<MotivationSourceRow>) =>
      row({
        kind: 'PART',
        costBasis: ProfitCostBasis.LAST_INCOME,
        label: 'Фильтр (OC 90)',
        ...over,
      });

    it('без закупки подбор не применим', () => {
      const [item] = build([
        part({
          costBasis: ProfitCostBasis.ESTIMATED_MARKUP,
          picker: {
            userId: 'user-parts',
            at: at('2026-07-15'),
            snapshotId: null,
          },
        }),
      ]).items;

      expect(item.notApplicable).toEqual(['RECOMMENDATION', 'PICKING']);
      expect(item.participants['ACTOR:PICKER']).toBeUndefined();
    });

    it('подборщик в смене — только его пары из смены', () => {
      const [item] = build([
        part({
          anchor: { createdAt: at('2026-07-15'), snapshotId: null },
          picker: {
            userId: 'user-parts',
            at: at('2026-07-15'),
            snapshotId: null,
          },
        }),
      ]).items;

      expect(item.participants['ACTOR:PICKER']).toEqual([
        pair('parts-1', PARTS),
      ]);
    });

    it('подборщик вне смены — все его должности', () => {
      const [item] = build([
        part({
          picker: {
            userId: 'user-admin',
            at: at('2026-09-10'),
            snapshotId: 'snap-rec',
          },
        }),
      ]).items;

      expect(item.participants['ACTOR:PICKER']).toEqual([
        pair('admin-1', ADMIN),
      ]);
    });

    it('старый подбор до графика — все его должности', () => {
      const [item] = build([
        part({
          picker: {
            userId: 'user-parts',
            at: at('2025-01-10'),
            snapshotId: null,
          },
        }),
      ]).items;

      expect(item.participants['ACTOR:PICKER']).toEqual([
        pair('parts-1', PARTS),
      ]);
    });

    it('автор не сотрудник — подборщика нет', () => {
      const [item] = build([
        part({
          picker: {
            userId: 'user-client',
            at: at('2026-09-10'),
            snapshotId: null,
          },
        }),
      ]).items;

      expect(item.participants['ACTOR:PICKER']).toEqual([]);
    });

    it('администратор, создавший позицию, отсекается профилем запчастей', () => {
      const facts = build([
        part({
          picker: {
            userId: 'user-admin',
            at: at('2026-09-10'),
            snapshotId: 'snap-item',
          },
        }),
      ]);
      const [result] = calculateMotivation(
        facts.items,
        buildTestScheme({ masterId: MASTER, adminId: ADMIN, partsId: PARTS }),
      );
      const picking = result.rows.filter((r) => r.stage === 'PICKING');

      // Запчастиста в смене нет — подбор уходит команде, а не лично автору
      expect(
        picking.map((r) => [r.employeeId, r.source, r.amountMinor]),
      ).toEqual([
        ['admin-1', 'SNAPSHOT:ITEM', 288n],
        ['master-1', 'SNAPSHOT:ITEM', 432n],
      ]);
    });
  });
});
