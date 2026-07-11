-- Сторонняя диагностика: рекомендация записана не по нашей диагностике
-- (сторонний автосервис / со слов клиента). Ранее для этого использовалась
-- фейковая организация в поле диагноста — переносим такие записи на флаг.

ALTER TABLE "car_recommendation" ADD COLUMN "external_diagnostic" BOOLEAN NOT NULL DEFAULT false;

-- Организация в диагностах — костыль «СТОРОННЯЯ ОРГАНИЗАЦИЯ» и подобные:
-- помечаем как стороннюю диагностику и очищаем диагноста.
UPDATE "car_recommendation"
SET "external_diagnostic" = true,
    "executor_kind" = NULL,
    "executor_id" = NULL
WHERE "executor_kind" = 'ORGANIZATION';
