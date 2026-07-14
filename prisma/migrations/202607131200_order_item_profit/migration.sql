-- Снапшот прибыли по позициям заказа (profit system, этап 3)
CREATE TABLE "order_item_profit" (
    "id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "revenue_amount" BIGINT NOT NULL,
    "cost_amount" BIGINT NOT NULL,
    "profit_amount" BIGINT NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL,
    "cost_basis" VARCHAR(16) NOT NULL,
    "origin" VARCHAR(16) NOT NULL,
    "warranty" BOOLEAN NOT NULL,
    "warranty_payer_kind" VARCHAR(16),
    "closed_at" TIMESTAMPTZ(0) NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_profit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_item_profit_order_item_id_key" ON "order_item_profit"("order_item_id");
CREATE INDEX "idx_order_item_profit_order_id" ON "order_item_profit"("order_id");
CREATE INDEX "idx_order_item_profit_tenant_closed" ON "order_item_profit"("tenant_id", "closed_at");

ALTER TABLE "order_item_profit" ADD CONSTRAINT "order_item_profit_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_item"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "order_item_profit" ADD CONSTRAINT "order_item_profit_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
