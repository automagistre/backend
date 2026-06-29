-- Унификация исполнителя работ: worker_id (person|organization|employee-дрейф) -> executor_kind/executor_id

ALTER TABLE "order_item_service" ADD COLUMN "executor_kind" VARCHAR(16);
ALTER TABLE "order_item_service" ADD COLUMN "executor_id" UUID;

-- Организации-исполнители
UPDATE "order_item_service" s
SET "executor_kind" = 'ORGANIZATION', "executor_id" = s."worker_id"
WHERE s."worker_id" IS NOT NULL
  AND s."worker_id" IN (SELECT "id" FROM "organization");

-- Персоны-исполнители
UPDATE "order_item_service" s
SET "executor_kind" = 'PERSON', "executor_id" = s."worker_id"
WHERE s."worker_id" IS NOT NULL
  AND s."executor_id" IS NULL
  AND s."worker_id" IN (SELECT "id" FROM "person");

-- Исторический дрейф: worker_id = employee.id -> person_id сотрудника
UPDATE "order_item_service" s
SET "executor_kind" = 'PERSON', "executor_id" = e."person_id"
FROM "employee" e
WHERE s."executor_id" IS NULL
  AND s."worker_id" = e."id";

ALTER TABLE "order_item_service" DROP COLUMN "worker_id";
