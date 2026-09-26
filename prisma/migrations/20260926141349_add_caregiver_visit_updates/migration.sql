-- CreateTable
CREATE TABLE "caregiver_visit_updates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "reviewed_by_id" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submitted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caregiver_visit_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "caregiver_visit_updates_visit_id_key" ON "caregiver_visit_updates"("visit_id");

-- CreateIndex
CREATE INDEX "caregiver_visit_updates_organization_id_status_idx" ON "caregiver_visit_updates"("organization_id", "status");

-- CreateIndex
CREATE INDEX "caregiver_visit_updates_author_id_status_idx" ON "caregiver_visit_updates"("author_id", "status");

-- AddForeignKey
ALTER TABLE "caregiver_visit_updates" ADD CONSTRAINT "caregiver_visit_updates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caregiver_visit_updates" ADD CONSTRAINT "caregiver_visit_updates_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caregiver_visit_updates" ADD CONSTRAINT "caregiver_visit_updates_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caregiver_visit_updates" ADD CONSTRAINT "caregiver_visit_updates_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
