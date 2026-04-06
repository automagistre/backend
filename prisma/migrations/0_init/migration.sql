-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('THING', 'PACKAGE', 'MILLILITER', 'LITER', 'GRAM', 'KILOGRAM', 'MILLIMETER', 'METER');

-- CreateEnum
CREATE TYPE "CarEngineType" AS ENUM ('UNKNOWN', 'PETROL', 'DIESEL', 'ETHANOL', 'ELECTRIC', 'HYBRID');

-- CreateEnum
CREATE TYPE "CarEngineAirIntake" AS ENUM ('UNKNOWN', 'ATMOSPHERIC', 'TURBO');

-- CreateEnum
CREATE TYPE "CarEngineInjection" AS ENUM ('UNKNOWN', 'CLASSIC', 'DIRECT');

-- CreateEnum
CREATE TYPE "CarTransmission" AS ENUM ('UNKNOWN', 'AUTOMATIC', 'ROBOT', 'VARIATOR', 'MECHANICAL', 'AUTOMATIC_5', 'AUTOMATIC_7');

-- CreateEnum
CREATE TYPE "CarWheelDrive" AS ENUM ('UNKNOWN', 'FRONT_WHEEL_DRIVE', 'REAR_WHEEL_DRIVE', 'ALL_WHEEL_DRIVE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'SCHEDULING', 'ORDERING', 'MATCHING', 'TRACKING', 'DELIVERY', 'NOTIFICATION', 'WORKING', 'READY', 'CLOSED', 'SELECTION', 'PAYMENT_WAITING', 'CANCELLED');

-- CreateTable
CREATE TABLE "manufacturer" (
    "id" UUID NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "localized_name" VARCHAR(255),
    "logo" VARCHAR(25),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "manufacturer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part" (
    "id" UUID NOT NULL,
    "manufacturer_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "universal" BOOLEAN NOT NULL,
    "unit" SMALLINT NOT NULL DEFAULT 1,
    "warehouse_id" UUID,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_price" (
    "id" UUID NOT NULL,
    "part_id" UUID NOT NULL,
    "since" TIMESTAMP(0) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "price_amount" BIGINT,
    "price_currency_code" VARCHAR(3),
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "part_price_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person" (
    "id" UUID NOT NULL,
    "firstname" VARCHAR(32),
    "lastname" VARCHAR(255),
    "telephone" VARCHAR(35),
    "office_phone" VARCHAR(35),
    "email" VARCHAR(255),
    "contractor" BOOLEAN NOT NULL,
    "seller" BOOLEAN NOT NULL,
    "tenant_group_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "balance" DECIMAL NOT NULL DEFAULT 0,

    CONSTRAINT "person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_model" (
    "id" UUID NOT NULL,
    "manufacturer_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "localized_name" VARCHAR(255),
    "case_name" VARCHAR(255),
    "year_from" SMALLINT,
    "year_till" SMALLINT,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "vehicle_model_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "car" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID,
    "identifier" VARCHAR(17),
    "year" INTEGER,
    "case_type" SMALLINT NOT NULL DEFAULT 1,
    "description" TEXT,
    "mileage" INTEGER NOT NULL,
    "gosnomer" VARCHAR(255),
    "tenant_group_id" UUID NOT NULL,
    "equipment_transmission" SMALLINT NOT NULL DEFAULT 0,
    "equipment_wheel_drive" SMALLINT NOT NULL DEFAULT 0,
    "equipment_engine_name" VARCHAR(255),
    "equipment_engine_type" SMALLINT NOT NULL DEFAULT 0,
    "equipment_engine_air_intake" SMALLINT NOT NULL DEFAULT 0,
    "equipment_engine_injection" SMALLINT NOT NULL DEFAULT 0,
    "equipment_engine_capacity" VARCHAR(255) NOT NULL DEFAULT '0.6',
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "car_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "car_recommendation" (
    "id" UUID NOT NULL,
    "car_id" UUID,
    "service" VARCHAR(255) NOT NULL,
    "worker_id" UUID NOT NULL,
    "expired_at" TIMESTAMP(0),
    "realization" UUID,
    "tenant_group_id" UUID NOT NULL,
    "price_amount" BIGINT,
    "price_currency_code" VARCHAR(3),
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "car_recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "car_recommendation_part" (
    "id" UUID NOT NULL,
    "recommendation_id" UUID NOT NULL,
    "part_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "tenant_group_id" UUID NOT NULL,
    "price_amount" BIGINT,
    "price_currency_code" VARCHAR(3),
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "car_recommendation_part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_entry" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "calendar_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_entry_deletion" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "reason" SMALLINT NOT NULL,
    "description" VARCHAR(255),
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "calendar_entry_deletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_entry_order" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "calendar_entry_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_entry_order_info" (
    "id" UUID NOT NULL,
    "entry_id" UUID,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID,
    "car_id" UUID,
    "description" TEXT,
    "worker_id" UUID,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "calendar_entry_order_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_entry_schedule" (
    "id" UUID NOT NULL,
    "entry_id" UUID,
    "tenant_id" UUID NOT NULL,
    "date" TIMESTAMP(0) NOT NULL,
    "duration" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "calendar_entry_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appeal_calculator" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "note" VARCHAR(255),
    "phone" VARCHAR(35) NOT NULL,
    "date" DATE,
    "equipment_id" UUID NOT NULL,
    "mileage" INTEGER NOT NULL,
    "total" BIGINT NOT NULL,
    "works" JSON NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "appeal_calculator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appeal_call" (
    "id" UUID NOT NULL,
    "phone" VARCHAR(35) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "appeal_call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appeal_cooperation" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(35) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "appeal_cooperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appeal_question" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "question" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "appeal_question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appeal_schedule" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(35) NOT NULL,
    "date" DATE NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "appeal_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appeal_status" (
    "id" UUID NOT NULL,
    "appeal_id" UUID NOT NULL,
    "status" SMALLINT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "appeal_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appeal_tire_fitting" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(35) NOT NULL,
    "model_id" UUID,
    "category" SMALLINT NOT NULL,
    "diameter" INTEGER,
    "total" BIGINT NOT NULL,
    "works" JSON NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "appeal_tire_fitting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_transaction" (
    "id" UUID NOT NULL,
    "operand_id" UUID NOT NULL,
    "source" SMALLINT NOT NULL,
    "source_id" UUID NOT NULL,
    "description" TEXT,
    "tenant_id" UUID NOT NULL,
    "amount_amount" BIGINT,
    "amount_currency_code" VARCHAR(3),
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "customer_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee" (
    "id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "ratio" INTEGER NOT NULL,
    "hired_at" TIMESTAMP(0) NOT NULL,
    "fired_at" TIMESTAMP(0),
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_salary" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "payday" INTEGER NOT NULL,
    "amount" BIGINT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "employee_salary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_salary_end" (
    "id" UUID NOT NULL,
    "salary_id" UUID,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "employee_salary_end_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "wallet_id" UUID,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "document" VARCHAR(255),
    "old_id" INTEGER,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_accrue" (
    "id" UUID NOT NULL,
    "income_id" UUID,
    "tenant_id" UUID NOT NULL,
    "amount_amount" BIGINT,
    "amount_currency_code" VARCHAR(3),
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "income_accrue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_part" (
    "id" UUID NOT NULL,
    "income_id" UUID,
    "part_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "tenant_id" UUID NOT NULL,
    "price_amount" BIGINT,
    "price_currency_code" VARCHAR(3),
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "income_part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mc_equipment" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "period" INTEGER NOT NULL,
    "tenant_id" UUID NOT NULL,
    "equipment_transmission" SMALLINT NOT NULL,
    "equipment_wheel_drive" SMALLINT NOT NULL,
    "equipment_engine_name" VARCHAR(255),
    "equipment_engine_type" SMALLINT NOT NULL,
    "equipment_engine_air_intake" SMALLINT NOT NULL,
    "equipment_engine_injection" SMALLINT NOT NULL,
    "equipment_engine_capacity" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "mc_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mc_line" (
    "id" UUID NOT NULL,
    "equipment_id" UUID,
    "work_id" UUID,
    "period" INTEGER NOT NULL,
    "recommended" BOOLEAN NOT NULL,
    "position" INTEGER NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "mc_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mc_part" (
    "id" UUID NOT NULL,
    "line_id" UUID,
    "part_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "recommended" BOOLEAN NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "mc_part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mc_work" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(255),
    "comment" VARCHAR(255),
    "tenant_id" UUID NOT NULL,
    "price_amount" BIGINT,
    "price_currency_code" VARCHAR(3),
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "mc_work_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motion" (
    "id" UUID NOT NULL,
    "part_id" UUID,
    "quantity" INTEGER NOT NULL,
    "description" TEXT,
    "tenant_id" UUID NOT NULL,
    "source_type" SMALLINT NOT NULL,
    "source_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "motion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note" (
    "id" UUID NOT NULL,
    "subject" UUID NOT NULL,
    "type" SMALLINT NOT NULL,
    "text" TEXT NOT NULL,
    "is_public" BOOLEAN DEFAULT false,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,

    CONSTRAINT "note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_delete" (
    "id" UUID NOT NULL,
    "note_id" UUID,
    "description" VARCHAR(255) NOT NULL DEFAULT '',
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,

    CONSTRAINT "note_delete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_cancel" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "order_cancel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_close" (
    "id" UUID NOT NULL,
    "order_id" UUID,
    "tenant_id" UUID NOT NULL,
    "type" VARCHAR(255) NOT NULL,

    CONSTRAINT "order_close_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_deal" (
    "id" UUID NOT NULL,
    "balance" BIGINT NOT NULL,
    "satisfaction" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "order_deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item" (
    "id" UUID NOT NULL,
    "order_id" UUID,
    "parent_id" UUID,
    "type" VARCHAR(255) NOT NULL,
    "tenant_id" UUID NOT NULL,

    CONSTRAINT "order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_group" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "hide_parts" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "order_item_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_service" (
    "id" UUID NOT NULL,
    "service" VARCHAR(255) NOT NULL,
    "worker_id" UUID,
    "warranty" BOOLEAN NOT NULL,
    "price_amount" BIGINT,
    "price_currency_code" VARCHAR(3),
    "discount_amount" BIGINT,
    "discount_currency_code" VARCHAR(3),
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "order_item_service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_part" (
    "id" UUID NOT NULL,
    "part_id" UUID NOT NULL,
    "supplier_id" UUID,
    "quantity" INTEGER NOT NULL,
    "warranty" BOOLEAN NOT NULL,
    "price_amount" BIGINT,
    "price_currency_code" VARCHAR(3),
    "discount_amount" BIGINT,
    "discount_currency_code" VARCHAR(3),
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "order_item_part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_payment" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "description" VARCHAR(255),
    "tenant_id" UUID NOT NULL,
    "money_amount" BIGINT,
    "money_currency_code" VARCHAR(3),
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "order_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "status" SMALLINT NOT NULL DEFAULT 1,
    "car_id" UUID,
    "customer_id" UUID,
    "worker_id" UUID,
    "mileage" INTEGER,
    "description" TEXT,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "address" VARCHAR(255),
    "telephone" VARCHAR(35),
    "office_phone" VARCHAR(35),
    "email" VARCHAR(255),
    "contractor" BOOLEAN NOT NULL,
    "seller" BOOLEAN NOT NULL,
    "tenant_group_id" UUID NOT NULL,
    "requisite_bank" VARCHAR(255),
    "requisite_legal_address" VARCHAR(255),
    "requisite_ogrn" VARCHAR(255),
    "requisite_inn" VARCHAR(255),
    "requisite_kpp" VARCHAR(255),
    "requisite_rs" VARCHAR(255),
    "requisite_ks" VARCHAR(255),
    "requisite_bik" VARCHAR(255),
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "balance" DECIMAL NOT NULL DEFAULT 0,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_case" (
    "id" UUID NOT NULL,
    "part_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "part_case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_cross_part" (
    "part_cross_id" UUID NOT NULL,
    "part_id" UUID NOT NULL,

    CONSTRAINT "part_cross_part_pkey" PRIMARY KEY ("part_cross_id","part_id")
);

-- CreateTable
CREATE TABLE "part_discount" (
    "id" UUID NOT NULL,
    "part_id" UUID NOT NULL,
    "since" TIMESTAMP(0) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "discount_amount" BIGINT,
    "discount_currency_code" VARCHAR(3),
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "part_discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_required_availability" (
    "id" UUID NOT NULL,
    "part_id" UUID NOT NULL,
    "order_from_quantity" INTEGER NOT NULL,
    "order_up_to_quantity" INTEGER NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "part_required_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_supply" (
    "id" UUID NOT NULL,
    "part_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "source" SMALLINT NOT NULL,
    "source_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "part_supply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation" (
    "id" UUID NOT NULL,
    "order_item_part_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review" (
    "id" UUID NOT NULL,
    "source_id" VARCHAR(255) NOT NULL,
    "source" SMALLINT NOT NULL,
    "author" VARCHAR(255) NOT NULL,
    "text" TEXT NOT NULL,
    "rating" SMALLINT NOT NULL,
    "publish_at" TIMESTAMP(0) NOT NULL,
    "raw" JSON,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "identifier" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id","group_id")
);

-- CreateTable
CREATE TABLE "tenant_group" (
    "id" UUID NOT NULL,
    "identifier" VARCHAR(255) NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_group_permission" (
    "user_id" UUID NOT NULL,
    "tenant_group_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_group_permission_pkey" PRIMARY KEY ("user_id","tenant_group_id")
);

-- CreateTable
CREATE TABLE "tenant_permission" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "use_in_income" BOOLEAN NOT NULL,
    "use_in_order" BOOLEAN NOT NULL,
    "show_in_layout" BOOLEAN NOT NULL,
    "default_in_manual_transaction" BOOLEAN NOT NULL,
    "tenant_id" UUID NOT NULL,
    "currency_code" VARCHAR(3),
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "balance" DECIMAL NOT NULL DEFAULT 0,

    CONSTRAINT "wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transaction" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "source" SMALLINT NOT NULL,
    "source_id" UUID NOT NULL,
    "description" TEXT,
    "tenant_id" UUID NOT NULL,
    "amount_amount" BIGINT,
    "amount_currency_code" VARCHAR(3),
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "wallet_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_code" (
    "id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "code" VARCHAR(255) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "warehouse_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_name" (
    "id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "warehouse_name_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_parent" (
    "id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "warehouse_parent_id" UUID,
    "tenant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "warehouse_parent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_3d0ae6dc5e237e06" ON "manufacturer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_490f70c696901f54a23b42d" ON "part"("number", "manufacturer_id");

-- CreateIndex
CREATE INDEX "idx_59bb753a4ce34bec" ON "part_price"("part_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_34dcd176450ff010dff2bbb0" ON "person"("telephone", "tenant_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_b53af235a23b42d5e237e06df3ba4b5" ON "vehicle_model"("manufacturer_id", "name", "case_name");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_773de69d772e836adff2bbb0" ON "car"("identifier", "tenant_group_id");

-- CreateIndex
CREATE INDEX "idx_8e4baaf2c3c6f69f" ON "car_recommendation"("car_id");

-- CreateIndex
CREATE INDEX "idx_ddc72d65d173940b" ON "car_recommendation_part"("recommendation_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_f118663dba364942" ON "calendar_entry_deletion"("entry_id");

-- CreateIndex
CREATE INDEX "idx_5fbde1c1ba364942" ON "calendar_entry_order_info"("entry_id");

-- CreateIndex
CREATE INDEX "idx_86fdaee3ba364942" ON "calendar_entry_schedule"("entry_id");

-- CreateIndex
CREATE INDEX "customer_transaction_operand_id_tenant_id_idx" ON "customer_transaction"("operand_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_person_fired" ON "employee"("person_id", "fired_at");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_59455a58b0fdf16e" ON "employee_salary_end"("salary_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_425dfa41640ed2c0" ON "income_accrue"("income_id");

-- CreateIndex
CREATE INDEX "idx_834566e8640ed2c0" ON "income_part"("income_id");

-- CreateIndex
CREATE INDEX "idx_b37ebc5f517fe9fe" ON "mc_line"("equipment_id");

-- CreateIndex
CREATE INDEX "idx_b37ebc5fbb3453db" ON "mc_line"("work_id");

-- CreateIndex
CREATE INDEX "idx_2b65786f4d7b7542" ON "mc_part"("line_id");

-- CreateIndex
CREATE INDEX "idx_f5fea1e84ce34bec" ON "motion"("part_id");

-- CreateIndex
CREATE INDEX "motion_tenant_id_part_id_idx" ON "motion"("tenant_id", "part_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_22c02b5326ed0855" ON "note_delete"("note_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_909ff5398d9f6d38" ON "order_close"("order_id");

-- CreateIndex
CREATE INDEX "idx_52ea1f09727aca70" ON "order_item"("parent_id");

-- CreateIndex
CREATE INDEX "idx_52ea1f098d9f6d38" ON "order_item"("order_id");

-- CreateIndex
CREATE INDEX "order_item_part_part_id_idx" ON "order_item_part"("part_id");

-- CreateIndex
CREATE INDEX "idx_9b522d468d9f6d38" ON "order_payment"("order_id");

-- CreateIndex
CREATE INDEX "idx_e52ffdee6b20ba36" ON "orders"("worker_id");

-- CreateIndex
CREATE INDEX "orders_car_id_idx" ON "orders"("car_id");

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "orders"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_e52ffdee96901f549033212a" ON "orders"("number", "tenant_id");

-- CreateIndex
CREATE INDEX "idx_part_case_vehicle_id" ON "part_case"("vehicle_id");

-- CreateIndex
CREATE INDEX "idx_part_case_part_id" ON "part_case"("part_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_2a0e7894ce34bec545317d1" ON "part_case"("part_id", "vehicle_id");

-- CreateIndex
CREATE INDEX "idx_part_cross_part_part_id" ON "part_cross_part"("part_id");

-- CreateIndex
CREATE INDEX "idx_part_cross_part_cross_id" ON "part_cross_part"("part_cross_id");

-- CreateIndex
CREATE INDEX "idx_76b231714ce34bec" ON "part_discount"("part_id");

-- CreateIndex
CREATE INDEX "idx_part_required_availability_part_id" ON "part_required_availability"("part_id");

-- CreateIndex
CREATE INDEX "part_required_availability_part_id_tenant_id_idx" ON "part_required_availability"("part_id", "tenant_id");

-- CreateIndex
CREATE INDEX "part_supply_part_id_idx" ON "part_supply"("part_id");

-- CreateIndex
CREATE INDEX "part_supply_supplier_id_idx" ON "part_supply"("supplier_id");

-- CreateIndex
CREATE INDEX "idx_42c84955437ef9d2" ON "reservation"("order_item_part_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_794381c65f8a7f73953c1c619033212a" ON "review"("source", "source_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "temporal_unique_idx" ON "tenant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_4e59c462772e836a" ON "tenant"("identifier");

-- CreateIndex
CREATE INDEX "idx_warehouse_code_warehouse_id" ON "warehouse_code"("warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_warehouse_code_code_tenant" ON "warehouse_code"("code", "tenant_id");

-- CreateIndex
CREATE INDEX "idx_warehouse_name_warehouse_id" ON "warehouse_name"("warehouse_id");

-- CreateIndex
CREATE INDEX "idx_warehouse_parent_warehouse_id" ON "warehouse_parent"("warehouse_id");

-- CreateIndex
CREATE INDEX "idx_warehouse_parent_parent_id" ON "warehouse_parent"("warehouse_parent_id");

-- AddForeignKey
ALTER TABLE "part" ADD CONSTRAINT "part_manufacturer_id_fkey" FOREIGN KEY ("manufacturer_id") REFERENCES "manufacturer"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "part_price" ADD CONSTRAINT "part_price_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "vehicle_model" ADD CONSTRAINT "vehicle_model_manufacturer_id_fkey" FOREIGN KEY ("manufacturer_id") REFERENCES "manufacturer"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "car" ADD CONSTRAINT "car_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle_model"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "car_recommendation" ADD CONSTRAINT "car_recommendation_car_id_fkey" FOREIGN KEY ("car_id") REFERENCES "car"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "car_recommendation_part" ADD CONSTRAINT "car_recommendation_part_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "car_recommendation"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "car_recommendation_part" ADD CONSTRAINT "car_recommendation_part_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "calendar_entry_deletion" ADD CONSTRAINT "fk_f118663dba364942" FOREIGN KEY ("entry_id") REFERENCES "calendar_entry"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "calendar_entry_order" ADD CONSTRAINT "calendar_entry_order_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "calendar_entry"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "calendar_entry_order_info" ADD CONSTRAINT "calendar_entry_order_info_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "calendar_entry"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "calendar_entry_order_info" ADD CONSTRAINT "calendar_entry_order_info_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "person"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "calendar_entry_order_info" ADD CONSTRAINT "calendar_entry_order_info_car_id_fkey" FOREIGN KEY ("car_id") REFERENCES "car"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "calendar_entry_order_info" ADD CONSTRAINT "calendar_entry_order_info_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "person"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "calendar_entry_schedule" ADD CONSTRAINT "calendar_entry_schedule_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "calendar_entry"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "employee" ADD CONSTRAINT "employee_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "employee_salary" ADD CONSTRAINT "employee_salary_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "employee_salary_end" ADD CONSTRAINT "fk_59455a58b0fdf16e" FOREIGN KEY ("salary_id") REFERENCES "employee_salary"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallet"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "income_accrue" ADD CONSTRAINT "fk_425dfa41640ed2c0" FOREIGN KEY ("income_id") REFERENCES "income"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "income_part" ADD CONSTRAINT "income_part_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "income_part" ADD CONSTRAINT "fk_834566e8640ed2c0" FOREIGN KEY ("income_id") REFERENCES "income"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mc_equipment" ADD CONSTRAINT "mc_equipment_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mc_line" ADD CONSTRAINT "fk_b37ebc5f517fe9fe" FOREIGN KEY ("equipment_id") REFERENCES "mc_equipment"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mc_line" ADD CONSTRAINT "fk_b37ebc5fbb3453db" FOREIGN KEY ("work_id") REFERENCES "mc_work"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mc_part" ADD CONSTRAINT "mc_part_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mc_part" ADD CONSTRAINT "fk_2b65786f4d7b7542" FOREIGN KEY ("line_id") REFERENCES "mc_line"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "motion" ADD CONSTRAINT "motion_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "note_delete" ADD CONSTRAINT "fk_22c02b5326ed0855" FOREIGN KEY ("note_id") REFERENCES "note"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_cancel" ADD CONSTRAINT "fk_9599d5a7bf396750" FOREIGN KEY ("id") REFERENCES "order_close"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_close" ADD CONSTRAINT "fk_909ff5398d9f6d38" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_deal" ADD CONSTRAINT "fk_ae0ffb01bf396750" FOREIGN KEY ("id") REFERENCES "order_close"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "order_item"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_item_group" ADD CONSTRAINT "order_item_group_id_fkey" FOREIGN KEY ("id") REFERENCES "order_item"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_item_service" ADD CONSTRAINT "order_item_service_id_fkey" FOREIGN KEY ("id") REFERENCES "order_item"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_item_part" ADD CONSTRAINT "order_item_part_id_fkey" FOREIGN KEY ("id") REFERENCES "order_item"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_item_part" ADD CONSTRAINT "order_item_part_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_item_part" ADD CONSTRAINT "order_item_part_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_payment" ADD CONSTRAINT "order_payment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_car_id_fkey" FOREIGN KEY ("car_id") REFERENCES "car"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "part_cross_part" ADD CONSTRAINT "part_cross_part_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "part_discount" ADD CONSTRAINT "part_discount_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "part_required_availability" ADD CONSTRAINT "part_required_availability_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "part_supply" ADD CONSTRAINT "part_supply_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "fk_42c84955437ef9d2" FOREIGN KEY ("order_item_part_id") REFERENCES "order_item_part"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "tenant_group"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "tenant_group_permission" ADD CONSTRAINT "tenant_group_permission_tenant_group_id_fkey" FOREIGN KEY ("tenant_group_id") REFERENCES "tenant_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenant_permission" ADD CONSTRAINT "tenant_permission_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "wallet_transaction" ADD CONSTRAINT "wallet_transaction_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallet"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "warehouse_code" ADD CONSTRAINT "warehouse_code_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "warehouse_name" ADD CONSTRAINT "warehouse_name_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "warehouse_parent" ADD CONSTRAINT "warehouse_parent_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "warehouse_parent" ADD CONSTRAINT "warehouse_parent_warehouse_parent_id_fkey" FOREIGN KEY ("warehouse_parent_id") REFERENCES "warehouse"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

