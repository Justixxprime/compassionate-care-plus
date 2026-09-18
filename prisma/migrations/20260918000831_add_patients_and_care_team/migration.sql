-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "date_of_birth" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_team_members" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_on_case" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3),

    CONSTRAINT "care_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patients_organization_id_idx" ON "patients"("organization_id");

-- CreateIndex
CREATE INDEX "care_team_members_patient_id_idx" ON "care_team_members"("patient_id");

-- CreateIndex
CREATE INDEX "care_team_members_user_id_idx" ON "care_team_members"("user_id");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_team_members" ADD CONSTRAINT "care_team_members_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_team_members" ADD CONSTRAINT "care_team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
