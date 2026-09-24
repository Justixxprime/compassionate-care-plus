-- CreateTable
CREATE TABLE "family_consents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "family_user_id" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "scopes" TEXT[],
    "granted_by_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "revoked_by_id" TEXT,

    CONSTRAINT "family_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "family_consents_family_user_id_revoked_at_idx" ON "family_consents"("family_user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "family_consents_patient_id_idx" ON "family_consents"("patient_id");

-- CreateIndex
CREATE INDEX "family_consents_organization_id_idx" ON "family_consents"("organization_id");

-- AddForeignKey
ALTER TABLE "family_consents" ADD CONSTRAINT "family_consents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_consents" ADD CONSTRAINT "family_consents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_consents" ADD CONSTRAINT "family_consents_family_user_id_fkey" FOREIGN KEY ("family_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_consents" ADD CONSTRAINT "family_consents_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_consents" ADD CONSTRAINT "family_consents_revoked_by_id_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
