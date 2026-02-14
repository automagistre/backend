import { registerEnumType } from '@nestjs/graphql';

/** Источники отзывов (как в старой CRM: review_source) */
export enum ReviewSource {
  Unknown = 0,
  Manual = 1,
  Yandex = 2,
  Google = 3,
  TwoGis = 4,
  Yell = 5,
}

const LABELS: Record<ReviewSource, string> = {
  [ReviewSource.Unknown]: 'Неизвестно',
  [ReviewSource.Manual]: 'Manual',
  [ReviewSource.Yandex]: 'Yandex',
  [ReviewSource.Google]: 'Google',
  [ReviewSource.TwoGis]: '2GIS',
  [ReviewSource.Yell]: 'Yell',
};

export function getReviewSourceLabel(source: number): string {
  return LABELS[source as ReviewSource] ?? `Источник ${source}`;
}

registerEnumType(ReviewSource, {
  name: 'ReviewSource',
  description: 'Источник отзыва',
});
