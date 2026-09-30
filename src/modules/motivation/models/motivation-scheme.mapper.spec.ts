import { BadRequestException } from '@nestjs/common';
import { buildStartScheme } from '../calculator/start-scheme';
import {
  fromMotivationSchemeInput,
  toMotivationSchemeModel,
} from './motivation-scheme.mapper';

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

  it('доли этапов не в сумме 100% — BadRequest', () => {
    const model = toMotivationSchemeModel(scheme);
    model.types[0].stages[0].shareBp += 1;
    expect(() => fromMotivationSchemeInput(model)).toThrow(BadRequestException);
  });

  it('неизвестный источник — BadRequest', () => {
    const model = toMotivationSchemeModel(scheme);
    model.types[0].stages[0].chain[0].source = 'ACTOR:ANYONE';
    expect(() => fromMotivationSchemeInput(model)).toThrow(/источник/);
  });

  it('без одного из типов — BadRequest', () => {
    const model = toMotivationSchemeModel(scheme);
    model.types.pop();
    expect(() => fromMotivationSchemeInput(model)).toThrow(/нет типов/);
  });
});
