// Companion to migration 20260919030000_replace_recurring_expense_frequency_
// with_has_fixed_date. That migration folds its own backfill directly into
// its SQL (an UPDATE between adding the new column and dropping the old
// one) rather than leaving it to a script run separately, unlike
// backfill-recurring-expenses.ts's own precedent -- hasFixedDate directly
// changes shouldCarryForwardToCycle's behavior (lib/cycles.ts), so there's
// no safe "default false, fix it up later" window to leave open the way a
// purely additive backfill can. By the time any script could run, the
// source column (`frequency`) the backfill rule reads is already gone.
//
// This script is a read-only POST-DEPLOY CHECK instead: confirms no row
// exists in either of the two shapes that would mean the migration's
// backfill missed something -- hasFixedDate=true with no dueDay ("Scheduled"
// but no actual date), or hasFixedDate=false with a dueDay set ("Ongoing"
// but still carrying a date around). Both were confirmed absent in dev and
// production before the migration was written; run this again any time
// after a deploy to reconfirm, or after any bulk data change.
import { prisma } from "@/lib/prisma";

async function main() {
  const scheduledMissingDueDay = await prisma.recurringExpense.findMany({
    where: { hasFixedDate: true, dueDay: null },
    select: { id: true, name: true, userId: true },
  });
  const ongoingWithDueDay = await prisma.recurringExpense.findMany({
    where: { hasFixedDate: false, dueDay: { not: null } },
    select: { id: true, name: true, userId: true, dueDay: true },
  });

  if (scheduledMissingDueDay.length === 0 && ongoingWithDueDay.length === 0) {
    console.log("OK: every RecurringExpense row's hasFixedDate/dueDay pair is consistent.");
    return;
  }

  if (scheduledMissingDueDay.length > 0) {
    console.log(
      `${scheduledMissingDueDay.length} row(s) marked Scheduled (hasFixedDate=true) with no dueDay -- review and either set a dueDay or flip to Ongoing:`,
    );
    console.log(JSON.stringify(scheduledMissingDueDay, null, 2));
  }
  if (ongoingWithDueDay.length > 0) {
    console.log(
      `${ongoingWithDueDay.length} row(s) marked Ongoing (hasFixedDate=false) but still carrying a dueDay -- review and either clear dueDay or flip to Scheduled:`,
    );
    console.log(JSON.stringify(ongoingWithDueDay, null, 2));
  }
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
