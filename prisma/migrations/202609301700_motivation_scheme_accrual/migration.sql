-- Схема премии хранится версиями: начисление берёт версию, действующую на момент закрытия заказа.
-- Строки начисления замораживают деньги, поэтому схему можно менять без пересчёта прошлого.

BEGIN;

CREATE TABLE "motivation_scheme" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "params" JSONB NOT NULL,
    "active_from" TIMESTAMPTZ(0) NOT NULL,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "motivation_scheme_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_motivation_scheme_version" ON "motivation_scheme"("tenant_id", "version");
CREATE INDEX "idx_motivation_scheme_active_from" ON "motivation_scheme"("tenant_id", "active_from");

ALTER TABLE "motivation_scheme" ADD CONSTRAINT "motivation_scheme_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- Строки распределения фонда позиции, включая «осталось в фонде» и «без адресата».
-- item_id — позиция заказа или договор хранения.
CREATE TABLE "motivation_accrual" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "item_type" VARCHAR(16) NOT NULL,
    "stage" VARCHAR(16),
    "employee_id" UUID,
    "position_id" UUID,
    "amount_amount" BIGINT NOT NULL,
    "amount_currency_code" VARCHAR(3) NOT NULL,
    "outcome" VARCHAR(16) NOT NULL,
    "reason" VARCHAR(16),
    "source" VARCHAR(32),
    "scheme_id" UUID NOT NULL,
    "customer_transaction_id" UUID,
    "created_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "motivation_accrual_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_motivation_accrual_row" ON "motivation_accrual"("item_id", "stage", "employee_id", "position_id") NULLS NOT DISTINCT;
CREATE INDEX "idx_motivation_accrual_order" ON "motivation_accrual"("tenant_id", "order_id");
CREATE INDEX "idx_motivation_accrual_employee" ON "motivation_accrual"("employee_id");

ALTER TABLE "motivation_accrual" ADD CONSTRAINT "motivation_accrual_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "motivation_accrual" ADD CONSTRAINT "motivation_accrual_scheme_id_fkey" FOREIGN KEY ("scheme_id") REFERENCES "motivation_scheme"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

COMMIT;
