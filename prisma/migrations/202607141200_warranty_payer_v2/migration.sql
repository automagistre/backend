-- Гарантия v2: полное разделение исполнителя и плательщика гарантии.
-- Плательщик теперь выбирается явно (EMPLOYEE|ORGANIZATION) для каждой
-- гарантийной позиции отдельно, без автоматического резолва по
-- родителю/ответственному по заказу. Backfill не требуется — существующие
-- гарантийные позиции в проде вручную сброшены перед миграцией.

ALTER TABLE "order_item_service" DROP COLUMN "warranty_payer";
ALTER TABLE "order_item_service" ADD COLUMN "warranty_payer_kind" VARCHAR(16);
ALTER TABLE "order_item_service" ADD COLUMN "warranty_payer_person_id" UUID;

ALTER TABLE "order_item_part" DROP COLUMN "warranty_payer";
ALTER TABLE "order_item_part" ADD COLUMN "warranty_payer_kind" VARCHAR(16);
ALTER TABLE "order_item_part" ADD COLUMN "warranty_payer_person_id" UUID;
