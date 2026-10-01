BEGIN;

-- Снапшот прибыли — EBITDA. Налоги и эквайринг считаются только в бонусе с продаж.
ALTER TABLE "order_item_profit" DROP COLUMN "overhead_amount";
ALTER TABLE "order_item_profit" DROP COLUMN "profit_before_overhead";

COMMIT;
