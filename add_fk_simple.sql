-- Простое добавление Foreign Key constraints с RESTRICT
-- Безопасно - не удаляет и не изменяет данные, только добавляет constraint'ы

-- Part -> Manufacturer
ALTER TABLE part
  ADD CONSTRAINT part_manufacturer_id_fkey 
  FOREIGN KEY (manufacturer_id) 
  REFERENCES manufacturer(id) 
  ON DELETE RESTRICT;

-- Vehicle -> Manufacturer  
ALTER TABLE vehicle_model
  ADD CONSTRAINT vehicle_model_manufacturer_id_fkey 
  FOREIGN KEY (manufacturer_id) 
  REFERENCES manufacturer(id) 
  ON DELETE RESTRICT;

-- Car -> Vehicle
ALTER TABLE car
  ADD CONSTRAINT car_vehicle_id_fkey
  FOREIGN KEY (vehicle_id)
  REFERENCES vehicle_model(id)
  ON DELETE RESTRICT;

-- Проверка
SELECT 
  tc.table_name AS "Таблица",
  tc.constraint_name AS "Constraint",
  rc.delete_rule AS "Удаление"
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_name IN (
  'part_manufacturer_id_fkey',
  'vehicle_model_manufacturer_id_fkey', 
  'car_vehicle_id_fkey'
);

