-- Снимок состава смены на момент продающего действия: кто в какой должности стоял в графике
-- рабочего дня. График правят задним числом и чистят каскадом при снятии должности,
-- поэтому премия опирается на снимок, а не на график.

BEGIN;

-- Одинаковый состав за тот же рабочий день — один снимок: строк за день сотни, состав меняется редко.
CREATE TABLE "shift_snapshot" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "members_hash" VARCHAR(64) NOT NULL,
    "taken_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_snapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_shift_snapshot_members" ON "shift_snapshot"("tenant_id", "work_date", "members_hash");

ALTER TABLE "shift_snapshot" ADD CONSTRAINT "shift_snapshot_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- Ссылки на сотрудника и должность по отдельности, а не на связку employee_staff_position:
-- снятие должности у сотрудника не должно стирать прошлые снимки.
CREATE TABLE "shift_snapshot_member" (
    "snapshot_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "position_id" UUID NOT NULL,

    CONSTRAINT "shift_snapshot_member_pkey" PRIMARY KEY ("snapshot_id", "employee_id", "position_id")
);

CREATE INDEX "idx_shift_snapshot_member_employee" ON "shift_snapshot_member"("employee_id");
CREATE INDEX "idx_shift_snapshot_member_position" ON "shift_snapshot_member"("position_id");

ALTER TABLE "shift_snapshot_member" ADD CONSTRAINT "shift_snapshot_member_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "shift_snapshot"("id") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "shift_snapshot_member" ADD CONSTRAINT "shift_snapshot_member_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "shift_snapshot_member" ADD CONSTRAINT "shift_snapshot_member_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "staff_position"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Якоря снимка. Старые записи остаются без снимка: для них премия идёт по справочнику команд.
ALTER TABLE "order_item" ADD COLUMN "shift_snapshot_id" UUID;
ALTER TABLE "car_recommendation" ADD COLUMN "shift_snapshot_id" UUID;
ALTER TABLE "tire_storage" ADD COLUMN "shift_snapshot_id" UUID;

CREATE INDEX "idx_order_item_shift_snapshot" ON "order_item"("shift_snapshot_id");
CREATE INDEX "idx_car_recommendation_shift_snapshot" ON "car_recommendation"("shift_snapshot_id");
CREATE INDEX "idx_tire_storage_shift_snapshot" ON "tire_storage"("shift_snapshot_id");

ALTER TABLE "order_item" ADD CONSTRAINT "order_item_shift_snapshot_id_fkey" FOREIGN KEY ("shift_snapshot_id") REFERENCES "shift_snapshot"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "car_recommendation" ADD CONSTRAINT "car_recommendation_shift_snapshot_id_fkey" FOREIGN KEY ("shift_snapshot_id") REFERENCES "shift_snapshot"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "tire_storage" ADD CONSTRAINT "tire_storage_shift_snapshot_id_fkey" FOREIGN KEY ("shift_snapshot_id") REFERENCES "shift_snapshot"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

COMMIT;
