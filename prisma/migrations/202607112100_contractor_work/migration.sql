-- Подрядные работы: kind/cost/warranty_payer на order_item_service, kind на car_recommendation,
-- пересчёт баланса кошелька при UPDATE/DELETE проводок (нужно для мутабельной ContractorPayout).

ALTER TABLE "order_item_service" ADD COLUMN "kind" VARCHAR(16) NOT NULL DEFAULT 'AUTOSERVICE';
ALTER TABLE "order_item_service" ADD COLUMN "warranty_payer" VARCHAR(16);
ALTER TABLE "order_item_service" ADD COLUMN "cost_amount" BIGINT;
ALTER TABLE "order_item_service" ADD COLUMN "cost_currency_code" VARCHAR(3);
ALTER TABLE "order_item_service" ADD COLUMN "cost_wallet_id" UUID;

ALTER TABLE "order_item_service"
  ADD CONSTRAINT "order_item_service_cost_wallet_id_fkey"
  FOREIGN KEY ("cost_wallet_id") REFERENCES "wallet"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Исторические работы с исполнителем-организацией — подрядные
UPDATE "order_item_service"
SET "kind" = 'CONTRACTOR'
WHERE "executor_kind" = 'ORGANIZATION';

ALTER TABLE "car_recommendation" ADD COLUMN "kind" VARCHAR(16) NOT NULL DEFAULT 'AUTOSERVICE';

UPDATE "car_recommendation"
SET "kind" = 'CONTRACTOR'
WHERE "executor_kind" = 'ORGANIZATION';

-- Существующий триггер пересчитывает баланс только на INSERT.
-- ContractorPayout мутабельна системой (update/delete), поэтому добавляем пересчёт и на эти операции.
CREATE OR REPLACE FUNCTION public.wallet_balance_sync_mutation_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.wallet_balance_sync(old.wallet_id);
        RETURN old;
    END IF;

    IF old.wallet_id IS DISTINCT FROM new.wallet_id THEN
        PERFORM public.wallet_balance_sync(old.wallet_id);
    END IF;
    PERFORM public.wallet_balance_sync(new.wallet_id);

    RETURN new;
END;
$function$;

CREATE TRIGGER wallet_balance_sync_mutation_trigger
AFTER UPDATE OR DELETE ON public.wallet_transaction
FOR EACH ROW EXECUTE FUNCTION public.wallet_balance_sync_mutation_trigger();
