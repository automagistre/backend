import { GraphQLScalarType, Kind, ValueNode } from 'graphql';
import type { Money } from '../../../common/money';

function parseMoneyString(value: unknown): Money {
  if (typeof value !== 'string') {
    throw new Error('MoneyInput must be a string like "RUB 100500"');
  }
  const parts = value.trim().split(/\s+/);
  if (parts.length !== 2) {
    throw new Error(
      `MoneyInput must be "<CURRENCY> <AMOUNT_MINOR>", got "${value}"`,
    );
  }
  const [currencyCode, amountRaw] = parts;
  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    throw new Error(`Bad currency code in MoneyInput: "${currencyCode}"`);
  }
  if (!/^-?\d+$/.test(amountRaw)) {
    throw new Error(`Amount must be integer (minor units), got "${amountRaw}"`);
  }
  return { currencyCode, amountMinor: BigInt(amountRaw) };
}

/**
 * Скаляр Money формата legacy CRM Symfony: строка `"<CURRENCY> <AMOUNT_MINOR>"`,
 * например `"RUB 100500"` = 1005.00 ₽. Сохранён 1-в-1, чтобы фронт www
 * не пришлось переписывать после переключения APOLLO_CRM_URL.
 *
 * Намеренно создаём GraphQLScalarType напрямую (без `@Scalar` декоратора),
 * чтобы тип попал ТОЛЬКО в схему www (через @Field в input'ах WwwModule),
 * а не в основной /api/v1/graphql.
 */
export const MoneyInputScalar = new GraphQLScalarType({
  name: 'SiteMoneyInput',
  description:
    'Money как "CURRENCY AMOUNT_MINOR", например "RUB 100500" (= 1005.00 ₽).',

  serialize(value: unknown): string {
    const v = value as Money;
    return `${v.currencyCode} ${v.amountMinor.toString()}`;
  },

  parseValue(value: unknown): Money {
    return parseMoneyString(value);
  },

  parseLiteral(ast: ValueNode): Money {
    if (ast.kind !== Kind.STRING) {
      throw new Error(`MoneyInput must be a string, got ${ast.kind}`);
    }
    return parseMoneyString(ast.value);
  },
});
