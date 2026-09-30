import {
  assertValidScheme,
  calculateMotivation,
  motivationTotalsByEmployee,
} from './motivation-calculator';
import type {
  MotivationItemFacts,
  MotivationItemResult,
  MotivationParticipant,
  MotivationScheme,
} from './motivation-calculator.types';
import { buildTestScheme } from './testing/test-scheme';

const MASTER = 'pos-master';
const ADMIN = 'pos-admin';
const PARTS = 'pos-parts';
const MECHANIC = 'pos-mechanic';

const scheme = buildTestScheme({
  masterId: MASTER,
  adminId: ADMIN,
  partsId: PARTS,
});

const pair = (
  employeeId: string,
  positionId: string,
): MotivationParticipant => ({
  employeeId,
  positionId,
});

/** Прибыль 12 000 при ставке услуги 10% даёт фонд 1 200. */
const service = (
  participants: MotivationItemFacts['participants'],
  over: Partial<MotivationItemFacts> = {},
): MotivationItemFacts => ({
  itemId: 'item-1',
  type: 'SERVICE',
  profitMinor: 12_000n,
  participants,
  ...over,
});

const calc = (facts: MotivationItemFacts, custom: MotivationScheme = scheme) =>
  calculateMotivation([facts], custom)[0];

/** Кто сколько получил: «сотрудник@должность» → сумма, по этапу или по всей позиции. */
const accrued = (result: MotivationItemResult, stage?: string) => {
  const out: Record<string, bigint> = {};
  for (const row of result.rows) {
    if (row.outcome !== 'ACCRUED' || (stage && row.stage !== stage)) continue;
    const key = `${row.employeeId}@${row.positionId}`;
    out[key] = (out[key] ?? 0n) + row.amountMinor;
  }
  return out;
};

const rowsSum = (result: MotivationItemResult) =>
  result.rows.reduce((sum, row) => sum + row.amountMinor, 0n);

describe('calculateMotivation', () => {
  it('пример из плана: 360 + 504 + 168 + 168 = 1 200', () => {
    const result = calc(
      service({
        'SNAPSHOT:RECOMMENDATION': [pair('admin-1', ADMIN)],
        'SNAPSHOT:ITEM': [
          pair('master-1', MASTER),
          pair('admin-1', ADMIN),
          pair('admin-2', ADMIN),
        ],
      }),
    );

    expect(result.fundMinor).toBe(1200n);
    expect(accrued(result, 'RECOMMENDATION')).toEqual({
      [`admin-1@${ADMIN}`]: 360n,
    });
    expect(accrued(result, 'TRANSFER')).toEqual({
      [`master-1@${MASTER}`]: 504n,
      [`admin-1@${ADMIN}`]: 168n,
      [`admin-2@${ADMIN}`]: 168n,
    });
    expect(rowsSum(result)).toBe(1200n);
  });

  it('один человек в смене забирает весь этап', () => {
    const result = calc(
      service({
        'SNAPSHOT:RECOMMENDATION': [pair('admin-1', ADMIN)],
        'SNAPSHOT:ITEM': [pair('admin-1', ADMIN)],
      }),
    );

    expect(accrued(result)).toEqual({ [`admin-1@${ADMIN}`]: 1200n });
  });

  it('профиль из одной должности отдаёт ей 100% этапа', () => {
    const custom: MotivationScheme = {
      ...scheme,
      profiles: { ...scheme.profiles, team: { [MASTER]: 1 } },
    };
    const result = calc(
      service(
        {
          'SNAPSHOT:ITEM': [pair('master-1', MASTER), pair('admin-1', ADMIN)],
        },
        { notApplicable: ['RECOMMENDATION'] },
      ),
      custom,
    );

    expect(accrued(result)).toEqual({ [`master-1@${MASTER}`]: 1200n });
  });

  it('двое одной должности делят котёл пополам', () => {
    const result = calc(
      service(
        { 'SNAPSHOT:ITEM': [pair('admin-1', ADMIN), pair('admin-2', ADMIN)] },
        { notApplicable: ['RECOMMENDATION'] },
      ),
    );

    expect(accrued(result)).toEqual({
      [`admin-1@${ADMIN}`]: 600n,
      [`admin-2@${ADMIN}`]: 600n,
    });
  });

  it('совместитель получает долю в котле каждой своей должности', () => {
    const result = calc(
      service(
        {
          'SNAPSHOT:ITEM': [
            pair('boss', MASTER),
            pair('boss', ADMIN),
            pair('admin-1', ADMIN),
          ],
        },
        { notApplicable: ['RECOMMENDATION'] },
      ),
    );

    expect(accrued(result)).toEqual({
      [`boss@${MASTER}`]: 720n,
      [`boss@${ADMIN}`]: 240n,
      [`admin-1@${ADMIN}`]: 240n,
    });
    expect(motivationTotalsByEmployee([result]).get('boss')).toBe(960n);
  });

  it('подмена без своей роли участвует только в котле подменяемой должности', () => {
    // Администратор вышел за мастера: в графике он стоит строкой мастера
    const result = calc(
      service(
        { 'SNAPSHOT:ITEM': [pair('admin-1', MASTER), pair('admin-2', ADMIN)] },
        { notApplicable: ['RECOMMENDATION'] },
      ),
    );

    expect(accrued(result)).toEqual({
      [`admin-1@${MASTER}`]: 720n,
      [`admin-2@${ADMIN}`]: 480n,
    });
  });

  it('механик в снимке есть, но с весом 0 в деньгах не участвует', () => {
    const result = calc(
      service(
        {
          'SNAPSHOT:ITEM': [pair('mech-1', MECHANIC), pair('admin-1', ADMIN)],
        },
        { notApplicable: ['RECOMMENDATION'] },
      ),
    );

    expect(accrued(result)).toEqual({ [`admin-1@${ADMIN}`]: 1200n });
  });

  it('рекомендации не было — её доля целиком уходит переводу', () => {
    const result = calc(
      service(
        { 'SNAPSHOT:ITEM': [pair('master-1', MASTER), pair('admin-1', ADMIN)] },
        { notApplicable: ['RECOMMENDATION'] },
      ),
    );

    expect(accrued(result, 'TRANSFER')).toEqual({
      [`master-1@${MASTER}`]: 720n,
      [`admin-1@${ADMIN}`]: 480n,
    });
    expect(result.rows.some((row) => row.outcome === 'KEPT_IN_FUND')).toBe(
      false,
    );
  });

  it('позиция без снимка идёт по графику, доля старой рекомендации — команде перевода', () => {
    const result = calc(
      service({
        'SCHEDULE:ITEM': [pair('master-1', MASTER), pair('admin-1', ADMIN)],
      }),
    );

    expect(accrued(result)).toEqual({
      [`master-1@${MASTER}`]: 720n,
      [`admin-1@${ADMIN}`]: 480n,
    });
    expect(result.rows.every((row) => row.source === 'SCHEDULE:ITEM')).toBe(
      true,
    );
  });

  it('снимок позиции важнее графика', () => {
    const result = calc(
      service({
        'SNAPSHOT:ITEM': [pair('master-1', MASTER)],
        'SCHEDULE:ITEM': [pair('master-2', MASTER), pair('admin-1', ADMIN)],
      }),
    );

    expect(accrued(result)).toEqual({ [`master-1@${MASTER}`]: 1200n });
  });

  it('в смене никого — цепочка идёт дальше, в конце перевод остаётся в фонде', () => {
    const result = calc(
      service({
        'SNAPSHOT:RECOMMENDATION': [pair('admin-1', ADMIN)],
        'SNAPSHOT:ITEM': [],
      }),
    );

    expect(accrued(result)).toEqual({ [`admin-1@${ADMIN}`]: 360n });
    expect(
      result.rows.find((row) => row.outcome === 'KEPT_IN_FUND'),
    ).toMatchObject({
      stage: 'TRANSFER',
      amountMinor: 840n,
      reason: 'NO_RECIPIENTS',
    });
    expect(rowsSum(result)).toBe(1200n);
  });

  it('ни один этап не нашёл адресата — весь фонд без атрибуции', () => {
    const result = calc(service({}, { notApplicable: ['RECOMMENDATION'] }));

    expect(result.rows).toEqual([
      expect.objectContaining({
        stage: null,
        outcome: 'UNATTRIBUTED',
        amountMinor: 1200n,
      }),
    ]);
  });

  it('убыточная позиция фонда не даёт', () => {
    const result = calc(
      service(
        { 'SNAPSHOT:ITEM': [pair('admin-1', ADMIN)] },
        { profitMinor: -5_000n },
      ),
    );

    expect(result.fundMinor).toBe(0n);
    expect(result.rows).toEqual([]);
  });

  it('копейки не теряются: 100 на троих — 34, 33, 33 по порядку id', () => {
    const custom: MotivationScheme = {
      ...scheme,
      types: {
        ...scheme.types,
        SERVICE: { ...scheme.types.SERVICE, rateBp: 10_000 },
      },
    };
    const result = calc(
      service(
        {
          'SNAPSHOT:ITEM': [
            pair('admin-c', ADMIN),
            pair('admin-a', ADMIN),
            pair('admin-b', ADMIN),
          ],
        },
        { profitMinor: 100n, notApplicable: ['RECOMMENDATION'] },
      ),
      custom,
    );

    expect(accrued(result)).toEqual({
      [`admin-a@${ADMIN}`]: 34n,
      [`admin-b@${ADMIN}`]: 33n,
      [`admin-c@${ADMIN}`]: 33n,
    });
  });

  it('повтор пары в источнике не удваивает долю', () => {
    const result = calc(
      service(
        {
          'SNAPSHOT:ITEM': [
            pair('admin-1', ADMIN),
            pair('admin-1', ADMIN),
            pair('admin-2', ADMIN),
          ],
        },
        { notApplicable: ['RECOMMENDATION'] },
      ),
    );

    expect(accrued(result)).toEqual({
      [`admin-1@${ADMIN}`]: 600n,
      [`admin-2@${ADMIN}`]: 600n,
    });
  });

  describe('запчасть', () => {
    const part = (
      participants: MotivationItemFacts['participants'],
      over: Partial<MotivationItemFacts> = {},
    ): MotivationItemFacts => ({
      itemId: 'part-1',
      type: 'PART',
      profitMinor: 10_000n,
      participants,
      ...over,
    });

    it('подбор уходит запчастисту-подборщику, продажа — команде', () => {
      const result = calc(
        part({
          'ACTOR:PICKER': [pair('parts-1', PARTS)],
          'SNAPSHOT:RECOMMENDATION': [pair('admin-1', ADMIN)],
          'SNAPSHOT:ITEM': [pair('master-1', MASTER), pair('parts-1', PARTS)],
        }),
      );

      expect(result.fundMinor).toBe(1000n);
      expect(accrued(result, 'PICKING')).toEqual({
        [`parts-1@${PARTS}`]: 600n,
      });
      expect(accrued(result, 'RECOMMENDATION')).toEqual({
        [`admin-1@${ADMIN}`]: 120n,
      });
      expect(accrued(result, 'TRANSFER')).toEqual({
        [`master-1@${MASTER}`]: 280n,
      });
    });

    it('позицию внёс администратор — подбор уходит запчастисту в смене', () => {
      const result = calc(
        part(
          {
            'ACTOR:PICKER': [pair('admin-1', ADMIN)],
            'SNAPSHOT:ITEM': [pair('admin-1', ADMIN), pair('parts-1', PARTS)],
          },
          { notApplicable: ['RECOMMENDATION'] },
        ),
      );

      expect(accrued(result, 'PICKING')).toEqual({
        [`parts-1@${PARTS}`]: 600n,
      });
      expect(result.rows.find((row) => row.stage === 'PICKING')?.source).toBe(
        'SNAPSHOT:ITEM',
      );
    });

    it('запчастиста нет в смене — подбор уходит команде', () => {
      const result = calc(
        part(
          {
            'ACTOR:PICKER': [pair('admin-1', ADMIN)],
            'SNAPSHOT:ITEM': [pair('master-1', MASTER), pair('admin-1', ADMIN)],
          },
          { notApplicable: ['RECOMMENDATION'] },
        ),
      );

      expect(accrued(result, 'PICKING')).toEqual({
        [`master-1@${MASTER}`]: 360n,
        [`admin-1@${ADMIN}`]: 240n,
      });
    });

    it('перевод без адресата — доля рекомендации уходит подбору, а не пропадает', () => {
      const result = calc(
        part(
          { 'ACTOR:PICKER': [pair('parts-1', PARTS)] },
          { notApplicable: ['RECOMMENDATION'] },
        ),
      );

      expect(accrued(result, 'PICKING')).toEqual({
        [`parts-1@${PARTS}`]: 720n,
      });
      expect(result.rows.find((row) => row.stage === 'TRANSFER')).toMatchObject(
        { outcome: 'KEPT_IN_FUND', amountMinor: 280n },
      );
    });

    it('нет закупки — подбор не применим и остаётся в фонде', () => {
      const result = calc(
        part(
          {
            'ACTOR:PICKER': [pair('parts-1', PARTS)],
            'SNAPSHOT:ITEM': [pair('master-1', MASTER)],
          },
          { notApplicable: ['PICKING', 'RECOMMENDATION'] },
        ),
      );

      expect(result.rows.find((row) => row.stage === 'PICKING')).toMatchObject({
        outcome: 'KEPT_IN_FUND',
        reason: 'NOT_APPLICABLE',
        amountMinor: 600n,
      });
      // Рекомендации не было: её 12% уходят единственному адресату — переводу
      expect(accrued(result, 'TRANSFER')).toEqual({
        [`master-1@${MASTER}`]: 400n,
      });
      expect(rowsSum(result)).toBe(1000n);
    });
  });

  it('договор хранения целиком уходит смене оформления', () => {
    const result = calc({
      itemId: 'storage-1',
      type: 'STORAGE',
      profitMinor: 200_000n,
      participants: {
        'SNAPSHOT:CONTRACT': [pair('master-1', MASTER), pair('admin-1', ADMIN)],
      },
    });

    expect(result.fundMinor).toBe(10_000n);
    expect(accrued(result, 'CONTRACT')).toEqual({
      [`master-1@${MASTER}`]: 6_000n,
      [`admin-1@${ADMIN}`]: 4_000n,
    });
  });

  it('инвариант: начислено + в фонде + без атрибуции = фонд позиции', () => {
    const people = [
      pair('e1', MASTER),
      pair('e2', ADMIN),
      pair('e3', ADMIN),
      pair('e3', PARTS),
      pair('e4', MECHANIC),
    ];
    for (let seed = 1; seed <= 200; seed += 1) {
      const pick = (salt: number) =>
        people.filter((_, index) => ((seed * 7 + salt) >> index) & 1);
      const type = (['SERVICE', 'CONTRACTOR', 'PART', 'STORAGE'] as const)[
        seed % 4
      ];
      const result = calc({
        itemId: `item-${seed}`,
        type,
        profitMinor: BigInt(seed * 9_973),
        notApplicable: seed % 3 === 0 ? ['RECOMMENDATION'] : [],
        participants: {
          'SNAPSHOT:ITEM': pick(1),
          'SNAPSHOT:RECOMMENDATION': pick(5),
          'SNAPSHOT:CONTRACT': pick(11),
          'ACTOR:PICKER': pick(3),
        },
      });

      expect(rowsSum(result)).toBe(result.fundMinor);
      expect(result.rows.every((row) => row.amountMinor > 0n)).toBe(true);
    }
  });
});

describe('assertValidScheme', () => {
  it('стартовая схема валидна', () => {
    expect(() => assertValidScheme(scheme)).not.toThrow();
  });

  it('доли этапов должны давать 10 000 б.п.', () => {
    const broken: MotivationScheme = {
      ...scheme,
      types: {
        ...scheme.types,
        STORAGE: {
          rateBp: 500,
          stages: [{ ...scheme.types.STORAGE.stages[0], shareBp: 9_000 }],
        },
      },
    };
    expect(() => assertValidScheme(broken)).toThrow('нужно 10 000');
  });

  it('цепочка не может ссылаться на неизвестный профиль', () => {
    const broken: MotivationScheme = {
      ...scheme,
      profiles: { team: scheme.profiles.team },
    };
    expect(() => assertValidScheme(broken)).toThrow('неизвестный профиль');
  });

  it('перераспределять можно только в этапы своего типа', () => {
    const [picking, recommendation, transfer] = scheme.types.PART.stages;
    const broken: MotivationScheme = {
      ...scheme,
      types: {
        ...scheme.types,
        PART: {
          ...scheme.types.PART,
          stages: [
            picking,
            { ...recommendation, redistributeTo: ['CONTRACT'] },
            transfer,
          ],
        },
      },
    };
    expect(() => assertValidScheme(broken)).toThrow('отсутствующий этап');
  });
});
