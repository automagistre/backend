import { registerEnumType } from '@nestjs/graphql';

/** Кто несёт стоимость гарантийной позиции. */
export enum WarrantyPayerKind {
  /** Конкретный сотрудник (warrantyPayerPersonId обязателен). */
  EMPLOYEE = 'EMPLOYEE',
  ORGANIZATION = 'ORGANIZATION',
}

registerEnumType(WarrantyPayerKind, {
  name: 'WarrantyPayerKind',
  description: 'Плательщик по гарантийной позиции',
  valuesMap: {
    EMPLOYEE: { description: 'Стоимость несёт конкретный сотрудник' },
    ORGANIZATION: { description: 'Стоимость несёт организация (автосервис)' },
  },
});
