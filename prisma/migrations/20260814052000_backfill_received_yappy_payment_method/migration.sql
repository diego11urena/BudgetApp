-- Data-fix, no schema change.
--
-- yappyReceivedParser used to leave paymentMethod null for a received
-- Yappy transfer ("money coming in has no payment-method concept" -- true
-- for a generic Income entry, but not for a Yappy transfer specifically,
-- which is always the Yappy rail either direction). The parser and the
-- create/update actions now carry paymentMethod through for INCOME too,
-- but every row imported before that change is still sitting on null and
-- reads unlabeled in the Transactions list.
--
-- Only Yappy's "received" template ever produces an INCOME-typed Gmail
-- import (see lib/gmail-parsers.ts), so this condition unambiguously
-- identifies exactly those rows, with no risk of touching a manually
-- logged Income entry (importSource stays MANUAL for those).
UPDATE "CycleTransaction"
SET "paymentMethod" = 'YAPPY'
WHERE "type" = 'INCOME' AND "importSource" = 'GMAIL' AND "paymentMethod" IS NULL;
