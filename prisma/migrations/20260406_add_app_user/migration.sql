-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "person_id" UUID,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_user_person_id_key" ON "app_user"("person_id");

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
