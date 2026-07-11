/**
 * Входные типы для RecommendationService.
 *
 * Причина:
 * - не держать inline-типы в методах сервиса;
 * - унифицировать контракт: update = create + id (id передаётся внутри объекта).
 */

export type CarRecommendationWriteFields = {
  service: string;
  /** AUTOSERVICE | CONTRACTOR — переносится в работу при реализации */
  kind?: string;
  /** Диагност — кто порекомендовал (всегда персона) */
  executorKind: string | null;
  executorId: string | null;
  /** Диагностика проведена не нами — диагност очищается */
  externalDiagnostic?: boolean;
  /** Будущий исполнитель-подрядчик (только для kind=CONTRACTOR) */
  contractorKind?: string | null;
  contractorId?: string | null;
  expiredAt?: Date | null;
  realization?: string | null;
  priceAmount?: bigint | null;
  priceCurrencyCode?: string | null;
};

export type CreateCarRecommendationServiceInput = {
  carId: string;
} & CarRecommendationWriteFields;

export type UpdateCarRecommendationServiceInput = {
  id: string;
} & Partial<CarRecommendationWriteFields>;

export type CarRecommendationPartWriteFields = {
  quantity: number;
  priceAmount?: bigint | null;
  priceCurrencyCode?: string | null;
};

export type CreateCarRecommendationPartServiceInput = {
  recommendationId: string;
  partId: string;
} & CarRecommendationPartWriteFields;

export type UpdateCarRecommendationPartServiceInput = {
  id: string;
  partId?: string;
} & Partial<CarRecommendationPartWriteFields>;
