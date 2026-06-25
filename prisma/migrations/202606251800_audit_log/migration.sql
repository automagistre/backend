-- CreateTable
CREATE TABLE "audit_log_event" (
    "id" UUID NOT NULL,
    "scope" VARCHAR(16) NOT NULL,
    "tenant_id" UUID,
    "tenant_group_id" UUID,
    "root_entity_type" VARCHAR(64) NOT NULL,
    "root_entity_id" UUID NOT NULL,
    "entity_type" VARCHAR(64) NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "actor_id" UUID,
    "entity_display_name" VARCHAR(255),
    "changes" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_audit_root" ON "audit_log_event"("root_entity_type", "root_entity_id", "id");

-- CreateIndex
CREATE INDEX "idx_audit_entity" ON "audit_log_event"("entity_type", "entity_id", "id");
