-- Должности сотрудников: справочник тенанта
CREATE TABLE "staff_position" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ(0),
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "staff_position_pkey" PRIMARY KEY ("id")
);

-- Архивная должность не должна блокировать новое имя: после увольнения всех
-- механиков можно снова завести «Механик», не переименовывая историю.
CREATE UNIQUE INDEX "uniq_staff_position_tenant_name"
ON "staff_position"("tenant_id", "name")
WHERE "archived_at" IS NULL;

CREATE INDEX "idx_staff_position_tenant_sort" ON "staff_position"("tenant_id", "sort_order");

-- Настройка должности из каталога в коде.
-- Строка есть — настройка задана, value хранит типизированное значение.
CREATE TABLE "staff_position_setting" (
    "position_id" UUID NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "staff_position_setting_pkey" PRIMARY KEY ("position_id", "key")
);

ALTER TABLE "staff_position_setting" ADD CONSTRAINT "staff_position_setting_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "staff_position"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Сотруднику можно назначить несколько должностей
CREATE TABLE "employee_staff_position" (
    "employee_id" UUID NOT NULL,
    "position_id" UUID NOT NULL,

    CONSTRAINT "employee_staff_position_pkey" PRIMARY KEY ("employee_id", "position_id")
);

CREATE INDEX "idx_employee_staff_position_position" ON "employee_staff_position"("position_id");

ALTER TABLE "employee_staff_position" ADD CONSTRAINT "employee_staff_position_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
-- RESTRICT: должность с привязками удаляется только через архивацию
ALTER TABLE "employee_staff_position" ADD CONSTRAINT "employee_staff_position_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "staff_position"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Процент от работ: null означает «процент не начисляется».
-- Прежний дефолт 100 молча отдавал исполнителю всю стоимость работы и обнулял маржу.
ALTER TABLE "employee" ALTER COLUMN "ratio" DROP NOT NULL;
