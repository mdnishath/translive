/*
  Warnings:

  - Added the required column `updatedAt` to the `contacts` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- AlterTable: add status (existing rows become ACCEPTED since they were already connected)
-- and updatedAt (existing rows get current timestamp as default)
ALTER TABLE "contacts"
  ADD COLUMN "status" "ContactStatus" NOT NULL DEFAULT 'ACCEPTED',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- After backfilling existing rows, change status default to PENDING for new rows
ALTER TABLE "contacts" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "conversation_participants" ADD COLUMN     "leftAt" TIMESTAMP(3);
