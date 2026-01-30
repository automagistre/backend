/**
 * Входные типы для RecommendationService.
 *
 * Причина:
 * - не держать inline-типы в методах сервиса;
 * - унифицировать контракт: update = create + id (id передаётся внутри объекта).
 */

export type CarRecommendationWriteFields = {
  service: string;
  workerId: string;
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
} & Partial<CarRecommendationPartWriteFields>;

