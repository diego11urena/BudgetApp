import type { Prisma, PrismaClient } from "@/app/generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Remembers the Gmail message behind every imported transaction matching
 * `where`, so the sync's reconcile re-scan (see gmail-sync.ts) doesn't
 * re-import something the user deleted. Call it BEFORE the delete -- the
 * message ids only exist on the rows being removed.
 */
export async function ignoreImportedMessages(db: Db, userId: string, where: Prisma.CycleTransactionWhereInput) {
  const rows = await db.cycleTransaction.findMany({
    where: { ...where, userId, sourceMessageId: { not: null } },
    select: { sourceMessageId: true },
  });
  if (rows.length === 0) return;
  await db.gmailIgnoredMessage.createMany({
    data: rows.map((r) => ({ userId, messageId: r.sourceMessageId as string })),
    skipDuplicates: true,
  });
}

/** Undo of a delete: the message may be imported again (it's about to be, by the restore itself). */
export async function unignoreMessage(db: Db, userId: string, messageId: string) {
  await db.gmailIgnoredMessage.deleteMany({ where: { userId, messageId } });
}
