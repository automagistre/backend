-- Цикличный график сотрудника. Маска из 1 и 0, длина маски и есть длина цикла:
-- 5/2 это 1111100, 4/4 это 11110000, 2/2/3 — цикл из 14 символов.
-- Первый символ соответствует дате shift_starts_on.
ALTER TABLE "employee" ADD COLUMN "shift_mask" VARCHAR(31);
ALTER TABLE "employee" ADD COLUMN "shift_starts_on" DATE;

-- Пустой график — сотрудник «по требованию», выходит только по отметкам в employee_shift_day.
-- Маска без якоря нечитаема, а маска из одних нулей означала бы «никогда не работает».
ALTER TABLE "employee" ADD CONSTRAINT "chk_employee_shift_pattern" CHECK (
    ("shift_mask" IS NULL AND "shift_starts_on" IS NULL)
    OR (
        "shift_mask" ~ '^[01]+$'
        AND "shift_mask" LIKE '%1%'
        AND "shift_starts_on" IS NOT NULL
    )
);

-- Отклонение от цикла на конкретный день: выход вне графика, отпуск, больничный, отгул.
-- Строка на день, а не диапазон: «кто сегодня в смене» остаётся обычным join по дате.
CREATE TABLE "employee_shift_day" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "comment" VARCHAR(255),
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "employee_shift_day_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_employee_shift_day" ON "employee_shift_day"("employee_id", "date");
CREATE INDEX "idx_employee_shift_day_tenant_date" ON "employee_shift_day"("tenant_id", "date");

ALTER TABLE "employee_shift_day" ADD CONSTRAINT "employee_shift_day_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
