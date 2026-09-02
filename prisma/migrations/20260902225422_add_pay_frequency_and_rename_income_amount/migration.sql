-- CreateEnum
CREATE TYPE "PayFrequency" AS ENUM ('QUINCENAL', 'MONTHLY');

-- AlterTable: default QUINCENAL preserves every existing account's current behavior
ALTER TABLE "User" ADD COLUMN     "payFrequency" "PayFrequency" NOT NULL DEFAULT 'QUINCENAL';

-- AlterTable: real column rename (not drop+add) so existing IncomeSource data survives
ALTER TABLE "IncomeSource" RENAME COLUMN "netQuincenaAmount" TO "netPayAmount";
