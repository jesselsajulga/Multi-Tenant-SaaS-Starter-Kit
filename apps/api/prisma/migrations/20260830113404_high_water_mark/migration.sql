/*
  Warnings:

  - You are about to drop the column `timestamp` on the `UsageEvent` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "UsageSyncStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- DropIndex
DROP INDEX "UsageEvent_organizationId_metric_idx";

-- DropIndex
DROP INDEX "UsageEvent_organizationId_timestamp_idx";

-- AlterTable
ALTER TABLE "UsageEvent" DROP COLUMN "timestamp",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "occurredAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UsageSyncLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "syncedThroughTimestamp" TIMESTAMP(3) NOT NULL,
    "syncedThroughId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "UsageSyncStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "stripeMeterEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsageSyncLog_idempotencyKey_key" ON "UsageSyncLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "UsageSyncLog_organizationId_metric_syncedThroughTimestamp_s_idx" ON "UsageSyncLog"("organizationId", "metric", "syncedThroughTimestamp", "syncedThroughId");

-- CreateIndex
CREATE INDEX "UsageSyncLog_status_idx" ON "UsageSyncLog"("status");

-- CreateIndex
CREATE INDEX "UsageEvent_organizationId_metric_createdAt_id_idx" ON "UsageEvent"("organizationId", "metric", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "UsageSyncLog" ADD CONSTRAINT "UsageSyncLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
