-- Клиент хранения: person | organization (как у orders.customer_id)
ALTER TABLE "tire_storage" DROP CONSTRAINT IF EXISTS "tire_storage_customer_id_fkey";
