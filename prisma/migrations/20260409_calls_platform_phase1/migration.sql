-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('RINGING', 'ANSWERED', 'MISSED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CallPersonMatchState" AS ENUM ('MATCHED', 'NOT_FOUND', 'AMBIGUOUS');

-- CreateEnum
CREATE TYPE "CallCallbackStatus" AS ENUM ('NOT_SET', 'CALLED_BACK');

-- CreateEnum
CREATE TYPE "CallRecordingState" AS ENUM ('NONE', 'PENDING', 'DOWNLOADED', 'FAILED');

-- CreateEnum
CREATE TYPE "CallRecordingSource" AS ENUM ('WEBHOOK_FILE_LINK', 'DATA_API_CALL_RECORDS', 'DATA_API_FULL_RECORD_LINK');

-- CreateEnum
CREATE TYPE "CallEventType" AS ENUM ('CREATED', 'RINGING', 'ANSWERED', 'MISSED', 'COMPLETED', 'RECORDING_READY');

-- CreateTable
CREATE TABLE "telephony_call" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tenant_group_id" UUID NOT NULL,
    "operator" VARCHAR(32) NOT NULL DEFAULT 'uis',
    "provider_call_session_id" VARCHAR(128) NOT NULL,
    "provider_communication_id" VARCHAR(128),
    "provider_external_id" VARCHAR(128),
    "direction" "CallDirection" NOT NULL,
    "status" "CallStatus" NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "answered_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),
    "duration_sec" INTEGER,
    "caller_phone" VARCHAR(35),
    "callee_phone" VARCHAR(35),
    "person_id" UUID,
    "person_match_state" "CallPersonMatchState" NOT NULL DEFAULT 'NOT_FOUND',
    "is_missed" BOOLEAN NOT NULL DEFAULT false,
    "callback_status" "CallCallbackStatus" NOT NULL DEFAULT 'NOT_SET',
    "callback_marked_at" TIMESTAMPTZ(6),
    "callback_marked_by_user_id" UUID,
    "recording_state" "CallRecordingState" NOT NULL DEFAULT 'NONE',
    "recording_source" "CallRecordingSource",
    "recording_provider_id" VARCHAR(255),
    "recording_available_until" TIMESTAMPTZ(6),
    "recording_last_provider_url" TEXT,
    "recording_path" VARCHAR(1024),
    "recording_mime" VARCHAR(255),
    "recording_size" BIGINT,
    "recording_hash" VARCHAR(255),
    "raw_payload" JSON,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),
    "created_by" UUID,

    CONSTRAINT "telephony_call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telephony_call_event" (
    "id" UUID NOT NULL,
    "call_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "operator" VARCHAR(32) NOT NULL DEFAULT 'uis',
    "external_event_id" VARCHAR(128),
    "provider_call_session_id" VARCHAR(128),
    "event_type" "CallEventType" NOT NULL,
    "event_at" TIMESTAMPTZ(6) NOT NULL,
    "payload" JSON,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telephony_call_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telephony_call_routing_binding" (
    "id" UUID NOT NULL,
    "operator" VARCHAR(32) NOT NULL DEFAULT 'uis',
    "line_external_id" VARCHAR(128),
    "virtual_phone" VARCHAR(35),
    "webhook_token" VARCHAR(255),
    "tenant_id" UUID NOT NULL,
    "tenant_group_id" UUID NOT NULL,
    "display_name" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),
    "created_by" UUID,

    CONSTRAINT "telephony_call_routing_binding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_call_operator_provider_session" ON "telephony_call"("operator", "provider_call_session_id");

-- CreateIndex
CREATE INDEX "idx_call_operator_provider_comm" ON "telephony_call"("operator", "provider_communication_id");

-- CreateIndex
CREATE INDEX "idx_call_tenant_started_at" ON "telephony_call"("tenant_id", "started_at");

-- CreateIndex
CREATE INDEX "idx_call_tenant_status_started_at" ON "telephony_call"("tenant_id", "status", "started_at");

-- CreateIndex
CREATE INDEX "idx_call_tenant_missed_callback" ON "telephony_call"("tenant_id", "is_missed", "callback_status");

-- CreateIndex
CREATE INDEX "idx_call_person_id" ON "telephony_call"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_call_event_operator_external_event" ON "telephony_call_event"("operator", "external_event_id");

-- CreateIndex
CREATE INDEX "idx_call_event_call_event_at" ON "telephony_call_event"("call_id", "event_at");

-- CreateIndex
CREATE INDEX "idx_call_event_tenant_event_at" ON "telephony_call_event"("tenant_id", "event_at");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_call_routing_operator_line" ON "telephony_call_routing_binding"("operator", "line_external_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_call_routing_operator_phone" ON "telephony_call_routing_binding"("operator", "virtual_phone");

-- CreateIndex
CREATE INDEX "idx_call_routing_operator_token" ON "telephony_call_routing_binding"("operator", "webhook_token");

-- CreateIndex
CREATE INDEX "idx_call_routing_tenant_active" ON "telephony_call_routing_binding"("tenant_id", "is_active");

-- AddForeignKey
ALTER TABLE "telephony_call"
  ADD CONSTRAINT "fk_telephony_call_person"
  FOREIGN KEY ("person_id") REFERENCES "person"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "telephony_call_event"
  ADD CONSTRAINT "fk_telephony_call_event_call"
  FOREIGN KEY ("call_id") REFERENCES "telephony_call"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

