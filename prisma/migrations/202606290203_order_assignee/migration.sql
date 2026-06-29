-- Ответственный заказа: worker_id (employee.id) -> assignee_id (person.id)

ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "fk_e52ffdee6b20ba36";
DROP INDEX IF EXISTS "idx_e52ffdee6b20ba36";

ALTER TABLE "orders" ADD COLUMN "assignee_id" UUID;

-- Backfill: worker_id ссылается на employee.id -> person_id сотрудника
UPDATE "orders" o
SET "assignee_id" = e."person_id"
FROM "employee" e
WHERE o."worker_id" = e."id";

ALTER TABLE "orders" DROP COLUMN "worker_id";

CREATE INDEX "idx_e52ffdee6b20ba36" ON "orders"("assignee_id");

ALTER TABLE "orders" ADD CONSTRAINT "orders_assignee_id_fkey"
  FOREIGN KEY ("assignee_id") REFERENCES "person"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
