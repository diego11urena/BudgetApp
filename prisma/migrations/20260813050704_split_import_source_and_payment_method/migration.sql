-- CreateEnum
CREATE TYPE "ImportSource" AS ENUM ('MANUAL', 'GMAIL');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'YAPPY');

-- AlterTable
ALTER TABLE "CycleTransaction" ADD COLUMN "importSource" "ImportSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "CycleTransaction" ADD COLUMN "paymentMethod" "PaymentMethod";

-- Data migration: the old "source" column conflated "how it arrived"
-- (Bank Import/Yappy meant Gmail either way) with "what it was paid with".
-- Split it into the two new columns; "Bank Import" rows default to Credit
-- Card since the original email body (which could say "débito") is gone by
-- now — a one-time best-effort backfill, not something future imports rely
-- on (see lib/gmail-parsers.ts, which parses this per-email going forward).
UPDATE "CycleTransaction" SET "importSource" = 'GMAIL' WHERE "source" IN ('BANK_IMPORT', 'YAPPY');
UPDATE "CycleTransaction" SET "paymentMethod" = 'CREDIT_CARD' WHERE "source" = 'BANK_IMPORT';
UPDATE "CycleTransaction" SET "paymentMethod" = 'YAPPY' WHERE "source" = 'YAPPY';

-- AlterTable
ALTER TABLE "CycleTransaction" DROP COLUMN "source";

-- DropEnum
DROP TYPE "TransactionSource";
