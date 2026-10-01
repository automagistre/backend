BEGIN;

ALTER TABLE "wallet" RENAME COLUMN "vat_rate_percent" TO "tax_rate_percent";

COMMIT;
