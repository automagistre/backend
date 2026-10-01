BEGIN;

-- Печать берёт НДС у организации, учёт расходов — у счёта.
ALTER TABLE "organization"
ADD COLUMN "vat_rate_percent" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "wallet"
ADD COLUMN "vat_rate_percent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "acquiring_rate_bp" INTEGER NOT NULL DEFAULT 0;

-- Прежняя ставка печати сервиса переносится на его организации.
UPDATE "organization" AS organization
SET "vat_rate_percent" = rate.vat_rate_percent
FROM (
  SELECT
    link.organization_id,
    (setting.value #>> '{}')::int AS vat_rate_percent
  FROM "tenant_organization" AS link
  JOIN "setting"
    ON setting.tenant_id = link.tenant_id
   AND setting.key = 'printVatRatePercent'
   AND jsonb_typeof(setting.value) = 'number'
) AS rate
WHERE organization.id = rate.organization_id
  AND rate.vat_rate_percent BETWEEN 0 AND 50;

DELETE FROM "setting" WHERE key = 'printVatRatePercent';

-- Прибыль позиции хранится уже за вычетом НДС и эквайринга.
ALTER TABLE "order_item_profit"
ADD COLUMN "overhead_amount" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN "profit_before_overhead" BIGINT NOT NULL DEFAULT 0;

UPDATE "order_item_profit"
SET "profit_before_overhead" = "profit_amount";

COMMIT;
