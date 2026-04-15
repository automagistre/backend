-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('QUALITY_CONTROL', 'GENERAL');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TaskResult" AS ENUM ('ALL_GOOD', 'ISSUES', 'NO_ANSWER', 'REFUSED');

-- CreateTable
CREATE TABLE "task" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" "TaskType" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "order_id" UUID,
    "customer_id" UUID,
    "assignee_user_id" UUID,
    "scheduled_at" TIMESTAMPTZ(0),
    "completed_at" TIMESTAMPTZ(0),
    "archived_at" TIMESTAMPTZ(0),
    "result" "TaskResult",
    "requires_management_action" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0),
    "created_by" UUID,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setting" (
    "tenant_id" UUID NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(0),
    "created_by" UUID,

    CONSTRAINT "setting_pkey" PRIMARY KEY ("tenant_id","key")
);

-- CreateIndex
CREATE INDEX "idx_task_tenant_type_status_scheduled" ON "task"("tenant_id", "type", "status", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_task_tenant_order_type" ON "task"("tenant_id", "order_id", "type");

-- CreateIndex
CREATE INDEX "idx_task_order_id" ON "task"("order_id");

-- CreateIndex
CREATE INDEX "idx_task_customer_id" ON "task"("customer_id");

-- CreateIndex
CREATE INDEX "idx_setting_tenant_id" ON "setting"("tenant_id");

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "fk_task_order_id"
FOREIGN KEY ("order_id") REFERENCES "orders"("id")
ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "fk_task_customer_id"
FOREIGN KEY ("customer_id") REFERENCES "person"("id")
ON DELETE SET NULL ON UPDATE NO ACTION;
