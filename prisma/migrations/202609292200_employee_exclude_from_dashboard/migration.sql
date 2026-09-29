BEGIN;

-- Счёт сотрудника ведётся не как зарплатный (например, руководитель):
-- не показывать в долгах сотрудников и выдаче зарплаты на главной.
ALTER TABLE "employee"
ADD COLUMN "exclude_from_dashboard" BOOLEAN NOT NULL DEFAULT false;

COMMIT;
