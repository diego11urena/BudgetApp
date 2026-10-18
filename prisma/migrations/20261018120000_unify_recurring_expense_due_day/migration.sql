-- Merges "Scheduled" and "Ongoing" recurring expenses into one list: an
-- item has a charge date exactly when dueDay is set, so hasFixedDate is
-- redundant and goes away.
--
-- Former Ongoing items (hasFixedDate = false) become undated items. The
-- app never wrote a dueDay for them, but clear it explicitly so none can
-- turn into a dated item by accident.
UPDATE "RecurringExpense" SET "dueDay" = NULL WHERE "hasFixedDate" = false;

ALTER TABLE "RecurringExpense" DROP COLUMN "hasFixedDate";
