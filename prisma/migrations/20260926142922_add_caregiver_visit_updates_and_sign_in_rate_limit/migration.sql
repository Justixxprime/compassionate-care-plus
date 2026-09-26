-- CreateTable
CREATE TABLE "sign_in_failures" (
    "id" TEXT NOT NULL,
    "identifier_hash" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sign_in_failures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sign_in_failures_identifier_hash_occurred_at_idx" ON "sign_in_failures"("identifier_hash", "occurred_at");
