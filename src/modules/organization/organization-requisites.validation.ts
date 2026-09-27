/** ИП или ООО. Отдельно не хранится: однозначно следует из длины ИНН. */
export type LegalForm = 'IP' | 'OOO';

export interface RequisiteNumbers {
  inn?: string | null;
  kpp?: string | null;
  ogrn?: string | null;
  bik?: string | null;
  rs?: string | null;
  ks?: string | null;
}

const KPP_PATTERN = /^\d{4}[\dA-Z]{2}\d{3}$/;
const ACCOUNT_WEIGHTS = [7, 1, 3];

/** Номера вводят с пробелами и дефисами — храним только значимые символы. */
export function normalizeRequisiteNumber(
  value: string | null | undefined,
): string | null {
  const cleaned = value?.replace(/[\s-]/g, '').toUpperCase() ?? '';
  return cleaned === '' ? null : cleaned;
}

export function legalFormByInn(
  inn: string | null | undefined,
): LegalForm | null {
  if (inn?.length === 12) return 'IP';
  if (inn?.length === 10) return 'OOO';
  return null;
}

function weightedMod11(value: string, weights: number[]): number {
  const sum = weights.reduce(
    (acc, weight, index) => acc + weight * Number(value[index]),
    0,
  );
  return (sum % 11) % 10;
}

export function isValidInn(inn: string): boolean {
  if (!/^\d+$/.test(inn)) return false;
  if (inn.length === 10) {
    return weightedMod11(inn, [2, 4, 10, 3, 5, 9, 4, 6, 8]) === Number(inn[9]);
  }
  if (inn.length === 12) {
    return (
      weightedMod11(inn, [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === Number(inn[10]) &&
      weightedMod11(inn, [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === Number(inn[11])
    );
  }
  return false;
}

/** ОГРН — 13 цифр (остаток от 11), ОГРНИП — 15 цифр (остаток от 13). */
export function isValidOgrn(ogrn: string): boolean {
  if (!/^\d+$/.test(ogrn) || (ogrn.length !== 13 && ogrn.length !== 15)) {
    return false;
  }
  const divisor = ogrn.length === 13 ? 11n : 13n;
  const control = (BigInt(ogrn.slice(0, -1)) % divisor) % 10n;
  return control === BigInt(ogrn[ogrn.length - 1]);
}

function accountKeyOk(prefix: string, account: string): boolean {
  const sum = [...(prefix + account)].reduce(
    (acc, char, index) => acc + Number(char) * ACCOUNT_WEIGHTS[index % 3],
    0,
  );
  return sum % 10 === 0;
}

/** Ключ расчётного счёта считается по последним трём цифрам БИК. */
export function isValidSettlementAccount(rs: string, bik: string): boolean {
  return /^\d{20}$/.test(rs) && accountKeyOk(bik.slice(-3), rs);
}

/** Ключ корр. счёта — по «0» и 5–6 цифрам БИК. */
export function isValidCorrespondentAccount(ks: string, bik: string): boolean {
  return /^\d{20}$/.test(ks) && accountKeyOk(`0${bik.slice(4, 6)}`, ks);
}

/**
 * Проверка номеров реквизитов по контрольным суммам. Значения — уже нормализованные.
 * Пустые поля не проверяются: обязательность решает вызывающий код.
 */
export function validateRequisiteNumbers(r: RequisiteNumbers): string[] {
  const errors: string[] = [];
  const form = legalFormByInn(r.inn);

  if (r.inn && !isValidInn(r.inn)) {
    errors.push('ИНН: 10 цифр у организации или 12 у ИП, проверьте цифры');
  }

  if (r.kpp) {
    if (form === 'IP') errors.push('У ИП нет КПП');
    else if (!KPP_PATTERN.test(r.kpp)) errors.push('КПП: 9 символов');
  }

  if (r.ogrn) {
    if (!isValidOgrn(r.ogrn)) {
      errors.push('ОГРН: 13 цифр у организации или 15 у ИП, проверьте цифры');
    } else if (form === 'IP' && r.ogrn.length !== 15) {
      errors.push('У ИП ОГРНИП из 15 цифр');
    } else if (form === 'OOO' && r.ogrn.length !== 13) {
      errors.push('У организации ОГРН из 13 цифр');
    }
  }

  const bikValid = Boolean(r.bik && /^\d{9}$/.test(r.bik));
  if (r.bik && !bikValid) errors.push('БИК: 9 цифр');
  if ((r.rs || r.ks) && !r.bik)
    errors.push('Укажите БИК банка для проверки счетов');
  if (r.rs && r.bik && bikValid && !isValidSettlementAccount(r.rs, r.bik)) {
    errors.push('Расчётный счёт не сходится с БИК, проверьте цифры');
  }
  if (r.ks && r.bik && bikValid && !isValidCorrespondentAccount(r.ks, r.bik)) {
    errors.push('Корр. счёт не сходится с БИК, проверьте цифры');
  }

  return errors;
}
