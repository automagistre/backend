-- Разделение ролей в рекомендации: executor = диагност (всегда персона),
-- contractor = будущий исполнитель-подрядчик (для kind=CONTRACTOR).

ALTER TABLE "car_recommendation" ADD COLUMN "contractor_kind" VARCHAR(16);
ALTER TABLE "car_recommendation" ADD COLUMN "contractor_id" UUID;

-- Исторические подрядные рекомендации: организация стояла в «диагностах» —
-- переносим её в подрядчика, диагноста очищаем (реального диагноста уже не восстановить).
UPDATE "car_recommendation"
SET "contractor_kind" = "executor_kind",
    "contractor_id"   = "executor_id",
    "executor_kind"   = NULL,
    "executor_id"     = NULL
WHERE "kind" = 'CONTRACTOR'
  AND "executor_kind" = 'ORGANIZATION';
