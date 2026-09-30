import { BadRequestException } from '@nestjs/common';
import { buildStartScheme } from '../calculator/start-scheme';
import {
  fromMotivationSchemeInput,
  toMotivationSchemeModel,
} from './motivation-scheme.mapper';
import { MotivationItemTypeEnum } from './motivation.enums';

const scheme = buildStartScheme({
  masterId: 'master',
  adminId: 'admin',
  partsId: 'parts',
});

describe('motivation scheme mapper', () => {
  it('схема переживает круг GraphQL → калькулятор', () => {
    expect(fromMotivationSchemeInput(toMotivationSchemeModel(scheme))).toEqual(
      scheme,
    );
  });

  it('наружу — все этапы типа, даже с долей 0', () => {
    const model = toMotivationSchemeModel({
      ...scheme,
      rates: { ...scheme.rates, SERVICE: { TRANSFER: 500 } },
    });
    const service = model.types.find(
      (type) => type.type === MotivationItemTypeEnum.SERVICE,
    );
    expect(service?.stages).toEqual([
      { stage: 'RECOMMENDATION', rateBp: 0 },
      { stage: 'TRANSFER', rateBp: 500 },
    ]);
  });

  it('этапы больше 100% прибыли — BadRequest', () => {
    const model = toMotivationSchemeModel(scheme);
    model.types[0].stages[0].rateBp = 10_000;
    expect(() => fromMotivationSchemeInput(model)).toThrow(BadRequestException);
  });

  it('без одного из типов — BadRequest', () => {
    const model = toMotivationSchemeModel(scheme);
    model.types.pop();
    expect(() => fromMotivationSchemeInput(model)).toThrow(/нет типов/);
  });
});
