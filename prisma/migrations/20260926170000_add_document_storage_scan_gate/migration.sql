-- A document is not visible until a trusted scanning workflow has marked it
-- clean. Existing synthetic database-backed files retain their current,
-- already-validated behavior through the defaults below.
ALTER TABLE "documents"
  ADD COLUMN "scan_status" TEXT NOT NULL DEFAULT 'clean',
  ADD COLUMN "storage_kind" TEXT NOT NULL DEFAULT 'database',
  ADD COLUMN "storage_key" TEXT;

-- R2 keys are opaque private identifiers. A key may refer to at most one
-- document; PostgreSQL permits multiple NULLs for database-backed documents.
CREATE UNIQUE INDEX "documents_storage_key_key" ON "documents"("storage_key");
