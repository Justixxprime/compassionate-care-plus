-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "patient_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "date_of_birth" TIMESTAMP(3) NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_organization" TEXT,
    "source_contact_name" TEXT,
    "source_contact_phone" TEXT,
    "requested_service" TEXT NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'routine',
    "reason" TEXT NOT NULL,
    "office_notes" TEXT,
    "decision_note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'received',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "referrals_organization_id_status_idx" ON "referrals"("organization_id", "status");

-- CreateIndex
CREATE INDEX "referrals_patient_id_idx" ON "referrals"("patient_id");

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
