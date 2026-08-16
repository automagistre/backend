-- Гарантированный минимум ЗП в месяц (копейки). null — механизм не применяется.
ALTER TABLE "employee"
ADD COLUMN "guaranteed_minimum_amount" BIGINT;
