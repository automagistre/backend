BEGIN;

-- Сотрудник получает только оклад: его доля бонуса с продаж остаётся организации.
ALTER TABLE "employee"
ADD COLUMN "salary_only" BOOLEAN NOT NULL DEFAULT false;

COMMIT;
