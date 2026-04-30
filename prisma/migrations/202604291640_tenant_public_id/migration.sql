-- Добавляем tenant.public_id как короткий 5-значный идентификатор для публичных интеграций
-- (нужен для URL вида /api/www/:publicId, /integrations/uis/:publicId, чтобы не светить UUID).

ALTER TABLE tenant ADD COLUMN public_id INTEGER;

DO $$
DECLARE
  rec RECORD;
  candidate INT;
BEGIN
  FOR rec IN SELECT id FROM tenant WHERE public_id IS NULL LOOP
    LOOP
      candidate := 10000 + floor(random() * 90000)::int;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM tenant WHERE public_id = candidate);
    END LOOP;
    UPDATE tenant SET public_id = candidate WHERE id = rec.id;
  END LOOP;
END $$;

ALTER TABLE tenant ALTER COLUMN public_id SET NOT NULL;
ALTER TABLE tenant ADD CONSTRAINT tenant_public_id_uniq UNIQUE (public_id);
