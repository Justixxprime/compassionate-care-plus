-- CreateTable
CREATE TABLE "document_access_grants" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "document_id" TEXT,
    "grantee_id" TEXT NOT NULL,
    "granted_by_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "revoked_by_id" TEXT,

    CONSTRAINT "document_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_access_grants_grantee_id_revoked_at_idx" ON "document_access_grants"("grantee_id", "revoked_at");

-- CreateIndex
CREATE INDEX "document_access_grants_patient_id_idx" ON "document_access_grants"("patient_id");

-- CreateIndex
CREATE INDEX "document_access_grants_organization_id_idx" ON "document_access_grants"("organization_id");

-- AddForeignKey
ALTER TABLE "document_access_grants" ADD CONSTRAINT "document_access_grants_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access_grants" ADD CONSTRAINT "document_access_grants_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access_grants" ADD CONSTRAINT "document_access_grants_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access_grants" ADD CONSTRAINT "document_access_grants_grantee_id_fkey" FOREIGN KEY ("grantee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access_grants" ADD CONSTRAINT "document_access_grants_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access_grants" ADD CONSTRAINT "document_access_grants_revoked_by_id_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
