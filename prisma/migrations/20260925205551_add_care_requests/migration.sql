-- CreateTable
CREATE TABLE "care_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "preferred_contact" TEXT NOT NULL,
    "service_interest" TEXT,
    "best_time" TEXT NOT NULL,
    "message" TEXT,
    "notify_email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "contacted_by_id" TEXT,
    "contacted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "care_requests_organization_id_status_idx" ON "care_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "care_requests_created_at_idx" ON "care_requests"("created_at");

-- AddForeignKey
ALTER TABLE "care_requests" ADD CONSTRAINT "care_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_requests" ADD CONSTRAINT "care_requests_contacted_by_id_fkey" FOREIGN KEY ("contacted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
