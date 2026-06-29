-- Ответственный записи календаря: worker_id (employee.id) -> assignee_id (person.id)
-- Внешняя вью calendar_entry_view зависит от worker_id — пересоздаём её на assignee_id.

DROP VIEW IF EXISTS "calendar_entry_view";

ALTER TABLE "calendar_entry_order_info" ADD COLUMN "assignee_id" UUID;

-- Backfill: персоны напрямую
UPDATE "calendar_entry_order_info" c
SET "assignee_id" = c."worker_id"
WHERE c."worker_id" IS NOT NULL
  AND c."worker_id" IN (SELECT "id" FROM "person");

-- Backfill: исторический дрейф worker_id = employee.id -> person_id сотрудника
UPDATE "calendar_entry_order_info" c
SET "assignee_id" = e."person_id"
FROM "employee" e
WHERE c."assignee_id" IS NULL
  AND c."worker_id" = e."id";

ALTER TABLE "calendar_entry_order_info"
  DROP CONSTRAINT IF EXISTS "calendar_entry_order_info_worker_id_fkey";

ALTER TABLE "calendar_entry_order_info" DROP COLUMN "worker_id";

ALTER TABLE "calendar_entry_order_info" ADD CONSTRAINT "calendar_entry_order_info_assignee_id_fkey"
  FOREIGN KEY ("assignee_id") REFERENCES "person"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE VIEW "calendar_entry_view" AS
 SELECT e.id,
    e.tenant_id,
    ces.date AS schedule_date,
    ces.duration AS schedule_duration,
    ceoi.customer_id AS order_info_customer_id,
    ceoi.car_id AS order_info_car_id,
    ceoi.description AS order_info_description,
    ceoi.assignee_id AS order_info_assignee_id,
    ceo.order_id
   FROM calendar_entry e
     LEFT JOIN calendar_entry_deletion ced ON e.id = ced.entry_id
     LEFT JOIN calendar_entry_order ceo ON ceo.entry_id = e.id
     JOIN LATERAL ( SELECT sub.id,
            sub.entry_id,
            sub.tenant_id,
            sub.date,
            sub.duration
           FROM calendar_entry_schedule sub
          WHERE sub.entry_id = e.id
          ORDER BY sub.id DESC
         LIMIT 1) ces ON true
     JOIN LATERAL ( SELECT sub.id,
            sub.entry_id,
            sub.tenant_id,
            sub.customer_id,
            sub.car_id,
            sub.description,
            sub.assignee_id
           FROM calendar_entry_order_info sub
          WHERE sub.entry_id = e.id
          ORDER BY sub.id DESC
         LIMIT 1) ceoi ON true
  WHERE ced.* IS NULL;
