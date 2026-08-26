-- AlterTable
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: add CycleTransaction.userId nullable first, backfill, then enforce NOT NULL.
ALTER TABLE "CycleTransaction" ADD COLUMN "userId" TEXT;

UPDATE "CycleTransaction" ct
SET "userId" = bc."userId"
FROM "BudgetCycle" bc
WHERE bc.id = ct."cycleId";

ALTER TABLE "CycleTransaction" ALTER COLUMN "userId" SET NOT NULL;

-- DropIndex (the old global-uniqueness constraint on sourceMessageId alone)
DROP INDEX "CycleTransaction_sourceMessageId_key";

-- CreateIndex (the new per-user constraint)
CREATE UNIQUE INDEX "CycleTransaction_userId_sourceMessageId_key" ON "CycleTransaction"("userId", "sourceMessageId");
