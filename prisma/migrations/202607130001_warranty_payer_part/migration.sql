-- Гарантия по запчастям: аналогично order_item_service, плательщик стоимости
-- гарантийной запчасти может отличаться от плательщика по работе.

ALTER TABLE "order_item_part" ADD COLUMN "warranty_payer" VARCHAR(16);
