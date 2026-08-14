-- Data-fix, no schema change.
--
-- Root cause: the 20260813040331_add_transaction_source migration's
-- catch-all backfill ("any Gmail-imported row still on the MANUAL default
-- gets BANK_IMPORT") ran before its two more-specific UPDATEs could ever
-- touch a received-Yappy row, because those match on expenseCategoryId,
-- and a received Yappy is type INCOME with no category at all (same as any
-- manually-logged Income transaction) -- so every received-Yappy row fell
-- through to the BANK_IMPORT default. The next migration
-- (20260813050704_split_import_source_and_payment_method) then read that
-- wrong "BANK_IMPORT" source and set paymentMethod = CREDIT_CARD on it.
--
-- Only Yappy's "received" template ever produces an INCOME-typed Gmail
-- import (bank card purchases and Yappy sends are both EXPENSE), so this
-- condition unambiguously identifies exactly the rows the backfill got
-- wrong, with no risk of touching a real credit-card purchase.
UPDATE "CycleTransaction"
SET "paymentMethod" = NULL
WHERE "type" = 'INCOME' AND "importSource" = 'GMAIL' AND "paymentMethod" = 'CREDIT_CARD';
