import {
  isValidCorrespondentAccount,
  isValidInn,
  isValidOgrn,
  isValidSettlementAccount,
  legalFormByInn,
  normalizeRequisiteNumber,
  validateRequisiteNumbers,
} from './organization-requisites.validation';

/** Реквизиты msk из переноса — заведомо корректные. */
const MSK = {
  inn: '166016686002',
  ogrn: '324774600492011',
  rs: '40802810620000372884',
  ks: '30101810745374525104',
  bik: '044525104',
};

describe('проверка реквизитов организации', () => {
  it('реквизиты действующих сервисов проходят проверку', () => {
    expect(validateRequisiteNumbers(MSK)).toEqual([]);
    expect(
      validateRequisiteNumbers({
        inn: '166017663015',
        ogrn: '318169000126792',
        rs: '40802810500000686477',
        ks: '30101810145250000974',
        bik: '044525974',
      }),
    ).toEqual([]);
    expect(
      validateRequisiteNumbers({
        inn: '507303160627',
        rs: '40802810940000009848',
        ks: '30101810400000000225',
        bik: '044525225',
      }),
    ).toEqual([]);
  });

  it('ИНН: длина 10 или 12 и контрольные цифры', () => {
    expect(isValidInn('166016686002')).toBe(true);
    expect(isValidInn('166016686003')).toBe(false);
    expect(isValidInn('7707083893')).toBe(true);
    expect(isValidInn('7707083894')).toBe(false);
    expect(isValidInn('12345')).toBe(false);
  });

  it('тип определяется по длине ИНН', () => {
    expect(legalFormByInn('166016686002')).toBe('IP');
    expect(legalFormByInn('7707083893')).toBe('OOO');
    expect(legalFormByInn(null)).toBeNull();
  });

  it('ОГРН и ОГРНИП по контрольной цифре', () => {
    expect(isValidOgrn('324774600492011')).toBe(true);
    expect(isValidOgrn('324774600492012')).toBe(false);
    expect(isValidOgrn('1027700132195')).toBe(true);
    expect(isValidOgrn('1027700132196')).toBe(false);
  });

  it('счета сверяются с БИК', () => {
    expect(isValidSettlementAccount(MSK.rs, MSK.bik)).toBe(true);
    expect(isValidSettlementAccount('40802810620000372885', MSK.bik)).toBe(
      false,
    );
    expect(isValidCorrespondentAccount(MSK.ks, MSK.bik)).toBe(true);
    expect(isValidCorrespondentAccount(MSK.ks, '049205603')).toBe(false);
  });

  it('опечатка в ИНН даёт понятную ошибку', () => {
    expect(validateRequisiteNumbers({ ...MSK, inn: '166016686003' })).toEqual([
      'ИНН: 10 цифр у организации или 12 у ИП, проверьте цифры',
    ]);
  });

  it('у ИП нет КПП, а ОГРН должен быть ОГРНИП', () => {
    expect(
      validateRequisiteNumbers({ inn: MSK.inn, kpp: '770701001' }),
    ).toEqual(['У ИП нет КПП']);
    expect(
      validateRequisiteNumbers({ inn: MSK.inn, ogrn: '1027700132195' }),
    ).toEqual(['У ИП ОГРНИП из 15 цифр']);
  });

  it('счёт без БИК не принимается', () => {
    expect(validateRequisiteNumbers({ rs: MSK.rs })).toEqual([
      'Укажите БИК банка для проверки счетов',
    ]);
  });

  it('пустые поля не проверяются', () => {
    expect(validateRequisiteNumbers({})).toEqual([]);
  });

  it('номера нормализуются', () => {
    expect(normalizeRequisiteNumber(' 1660 1668-6002 ')).toBe('166016686002');
    expect(normalizeRequisiteNumber('  ')).toBeNull();
  });
});
