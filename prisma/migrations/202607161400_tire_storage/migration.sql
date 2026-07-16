-- Договор сезонного хранения шин/дисков
CREATE TABLE "tire_storage" (
    "id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "tenant_group_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "car_id" UUID,
    "order_id" UUID,
    "amount_amount" BIGINT NOT NULL,
    "amount_currency_code" VARCHAR(3) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "radius" INTEGER NOT NULL,
    "manufacturer" VARCHAR(255) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 4,
    "on_disks" BOOLEAN NOT NULL DEFAULT false,
    "season" VARCHAR(16) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'ENTERED',
    "accepted_at" TIMESTAMPTZ(0),
    "expires_at" TIMESTAMPTZ(0),
    "closed_at" TIMESTAMPTZ(0),
    "closed_by_id" UUID,
    "note" VARCHAR(255),
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "tire_storage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_tire_storage_number_tenant_group" ON "tire_storage"("number", "tenant_group_id");
CREATE INDEX "idx_tire_storage_customer" ON "tire_storage"("customer_id");
CREATE INDEX "idx_tire_storage_order" ON "tire_storage"("order_id");
CREATE INDEX "idx_tire_storage_group_status" ON "tire_storage"("tenant_group_id", "status");

ALTER TABLE "tire_storage" ADD CONSTRAINT "tire_storage_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "person"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "tire_storage" ADD CONSTRAINT "tire_storage_car_id_fkey" FOREIGN KEY ("car_id") REFERENCES "car"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "tire_storage" ADD CONSTRAINT "tire_storage_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Прибыль хранения: order_item_id nullable + storage_id
ALTER TABLE "order_item_profit" ALTER COLUMN "order_item_id" DROP NOT NULL;
ALTER TABLE "order_item_profit" ADD COLUMN "storage_id" UUID;
CREATE UNIQUE INDEX "order_item_profit_storage_id_key" ON "order_item_profit"("storage_id");
ALTER TABLE "order_item_profit" ADD CONSTRAINT "order_item_profit_storage_id_fkey" FOREIGN KEY ("storage_id") REFERENCES "tire_storage"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
