/*
  Warnings:

  - A unique constraint covering the columns `[user_id]` on the table `patients` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "user_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "patients_user_id_key" ON "patients"("user_id");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
