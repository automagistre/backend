-- График переезжает с сотрудника на пару сотрудник–должность: совместитель ведётся
-- в графике строкой на каждую должность и в один день может работать в двух ролях.
-- Цикл — на связке employee_staff_position, отметки выхода и отгула — на должность,
-- отпуск и больничный — на человека (position_id IS NULL).

-- Перенос данных: либо целиком, либо никак.
BEGIN;

ALTER TABLE "employee_staff_position" ADD COLUMN "shift_mask" VARCHAR(31);
ALTER TABLE "employee_staff_position" ADD COLUMN "shift_starts_on" DATE;

ALTER TABLE "employee_staff_position" ADD CONSTRAINT "chk_employee_staff_position_shift_pattern" CHECK (
    ("shift_mask" IS NULL AND "shift_starts_on" IS NULL)
    OR (
        "shift_mask" ~ '^[01]+$'
        AND "shift_mask" LIKE '%1%'
        AND "shift_starts_on" IS NOT NULL
    )
);

-- Основная должность — меньший sort_order, при равенстве меньший id: так же выбирает сервис.
CREATE TEMPORARY TABLE "tmp_primary_position" ON COMMIT DROP AS
SELECT DISTINCT ON (l."employee_id") l."employee_id", l."position_id"
FROM "employee_staff_position" l
JOIN "staff_position" p ON p."id" = l."position_id"
ORDER BY l."employee_id", p."sort_order", p."id";

-- Молча терять график нельзя: цикл или выход/отгул без должности переносить некуда.
DO $$
DECLARE
    orphan_cycles INTEGER;
    orphan_marks INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphan_cycles
    FROM "employee" e
    WHERE e."shift_mask" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "tmp_primary_position" t WHERE t."employee_id" = e."id");

    SELECT COUNT(*) INTO orphan_marks
    FROM "employee_shift_day" d
    WHERE d."kind" IN ('WORK', 'DAY_OFF')
      AND NOT EXISTS (SELECT 1 FROM "tmp_primary_position" t WHERE t."employee_id" = d."employee_id");

    IF orphan_cycles > 0 OR orphan_marks > 0 THEN
        RAISE EXCEPTION 'Сотрудники без должности: циклов %, отметок выхода/отгула %. Назначьте должность и повторите миграцию.',
            orphan_cycles, orphan_marks;
    END IF;
END $$;

UPDATE "employee_staff_position" l
SET "shift_mask" = e."shift_mask",
    "shift_starts_on" = e."shift_starts_on"
FROM "employee" e, "tmp_primary_position" t
WHERE t."employee_id" = e."id"
  AND l."employee_id" = t."employee_id"
  AND l."position_id" = t."position_id"
  AND e."shift_mask" IS NOT NULL;

ALTER TABLE "employee_shift_day" ADD COLUMN "position_id" UUID;

UPDATE "employee_shift_day" d
SET "position_id" = t."position_id"
FROM "tmp_primary_position" t
WHERE t."employee_id" = d."employee_id"
  AND d."kind" IN ('WORK', 'DAY_OFF');

-- Отметка должности живёт, пока должность назначена: снятие должности уносит её график.
-- При position_id IS NULL (отметка на человека) внешний ключ не проверяется.
ALTER TABLE "employee_shift_day" ADD CONSTRAINT "employee_shift_day_employee_position_fkey"
    FOREIGN KEY ("employee_id", "position_id")
    REFERENCES "employee_staff_position"("employee_id", "position_id")
    ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "employee_shift_day" ADD CONSTRAINT "chk_employee_shift_day_scope" CHECK (
    ("kind" IN ('VACATION', 'SICK')) = ("position_id" IS NULL)
);

-- На день одна отметка на человека и по одной на каждую должность.
DROP INDEX "uniq_employee_shift_day";
CREATE UNIQUE INDEX "uniq_employee_shift_day_person" ON "employee_shift_day"("employee_id", "date")
    WHERE "position_id" IS NULL;
CREATE UNIQUE INDEX "uniq_employee_shift_day_position" ON "employee_shift_day"("employee_id", "position_id", "date")
    WHERE "position_id" IS NOT NULL;

ALTER TABLE "employee" DROP CONSTRAINT "chk_employee_shift_pattern";
ALTER TABLE "employee" DROP COLUMN "shift_mask";
ALTER TABLE "employee" DROP COLUMN "shift_starts_on";

COMMIT;
