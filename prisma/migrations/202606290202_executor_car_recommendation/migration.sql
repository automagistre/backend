-- Унификация диагноста рекомендаций: worker_id (person|organization) -> executor_kind/executor_id

ALTER TABLE "car_recommendation" ADD COLUMN "executor_kind" VARCHAR(16);
ALTER TABLE "car_recommendation" ADD COLUMN "executor_id" UUID;

-- Организации-исполнители
UPDATE "car_recommendation" r
SET "executor_kind" = 'ORGANIZATION', "executor_id" = r."worker_id"
WHERE r."worker_id" IS NOT NULL
  AND r."worker_id" IN (SELECT "id" FROM "organization");

-- Персоны-исполнители
UPDATE "car_recommendation" r
SET "executor_kind" = 'PERSON', "executor_id" = r."worker_id"
WHERE r."worker_id" IS NOT NULL
  AND r."executor_id" IS NULL
  AND r."worker_id" IN (SELECT "id" FROM "person");

-- Исторический дрейф: worker_id = employee.id -> person_id сотрудника
UPDATE "car_recommendation" r
SET "executor_kind" = 'PERSON', "executor_id" = e."person_id"
FROM "employee" e
WHERE r."executor_id" IS NULL
  AND r."worker_id" = e."id";

ALTER TABLE "car_recommendation" DROP COLUMN "worker_id";
