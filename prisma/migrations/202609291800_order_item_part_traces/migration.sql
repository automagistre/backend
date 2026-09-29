BEGIN;

-- След подбора для мотивации: доля подбора идёт автору запчасти рекомендации.
ALTER TABLE "order_item_part" ADD COLUMN "recommendation_part_id" UUID;

CREATE INDEX "idx_order_item_part_recommendation_part" ON "order_item_part"("recommendation_part_id");

-- Удаление рекомендации не должно блокироваться реализованными запчастями
ALTER TABLE "order_item_part" ADD CONSTRAINT "order_item_part_recommendation_part_id_fkey" FOREIGN KEY ("recommendation_part_id") REFERENCES "car_recommendation_part"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

COMMIT;
