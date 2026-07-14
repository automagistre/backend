/**
 * Канонический whitelist подрядных работ (согласованный список названий).
 * Используется для автодетекта в autocomplete — не опираемся на исторические
 * рекомендации в БД, где autoservice-работы могли быть помечены как подрядные.
 *
 * TODO: автоматизировать обновление whitelist — единый источник (настройки тенанта
 * или справочник в БД), синхронизация с backfill-миграциями и UI управления списком.
 * Сейчас дублируется в prisma/migrations/202607120200_backfill_contractor_recommendations.
 */
export const CONTRACTOR_SERVICE_WHITELIST = [
  'Ремонт генератора',
  'Ремонт рулевой рейки',
  'Сезонное хранение шин',
  'Ремонт стартера',
  'Хранение шин',
  'Хранение шин на дисках',
  'Ремонт карданного вала',
  'Шлифовка плоскости ГБЦ',
  'Опрессовка ГБЦ',
  'Сезонное хранение шин с дисками',
  'Капитальный ремонт рулевой рейки',
  'Технологическая мойка ГБЦ',
  'Предварительная мойка ГБЦ',
  'Притирка клапанов',
  'Рассухаривание клапанов',
  'Капитальный ремонт карданного вала',
  'Комплексный ремонт головки блока',
  'Правка седел клапанов',
  'Фрезеровка плоскости головки блока',
  'Вакуум тест камеры сгорания',
] as const;

const contractorWhitelistLower = new Set(
  CONTRACTOR_SERVICE_WHITELIST.map((name) => name.toLowerCase()),
);

/** Проверка названия по whitelist (case-insensitive, с trim). */
export function isContractorServiceWhitelisted(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized.length > 0 && contractorWhitelistLower.has(normalized);
}
