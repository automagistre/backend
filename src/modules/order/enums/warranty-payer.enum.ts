import { registerEnumType } from '@nestjs/graphql';

/** Кто несёт стоимость гарантийной работы. */
export enum WarrantyPayer {
  EXECUTOR = 'EXECUTOR',
  ORGANIZATION = 'ORGANIZATION',
}

registerEnumType(WarrantyPayer, {
  name: 'WarrantyPayer',
  description: 'Плательщик по гарантийной работе',
  valuesMap: {
    EXECUTOR: { description: 'Стоимость несёт исполнитель (сотрудник/подрядчик)' },
    ORGANIZATION: { description: 'Стоимость несёт организация (автосервис)' },
  },
});

/** Человекочитаемая подпись плательщика — используется, например, в тексте гарантийной заметки. */
export const WarrantyPayerLabel: Record<WarrantyPayer, string> = {
  [WarrantyPayer.EXECUTOR]: 'Механик',
  [WarrantyPayer.ORGANIZATION]: 'Организация',
};
