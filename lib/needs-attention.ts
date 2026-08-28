import { prisma } from "@/lib/prisma";

export interface NeedsAttentionTransaction {
  id: string;
  name: string;
  amount: number;
  type: "EXPENSE" | "INCOME" | "SAVINGS";
  needsCategory: boolean;
  needsDescription: boolean;
  /** Yappy is P2P — the counterparty's name alone doesn't say what the money was for, in either direction. Only used for the row's label when needsDescription. */
  direction: "sent" | "received";
}

/**
 * A transaction can be missing a category, a description, or both — most
 * commonly a Yappy/Gmail import with no learned-merchant category AND no
 * message attached. One query, one combined list, so a transaction missing
 * both never has to be finished across two separate banners/sheets (see
 * NeedsAttentionSheet). "Needs a category": every type now has a category
 * concept (Extra income included, see lib/categories.ts), so this isn't
 * EXPENSE-specific. "Needs a description": Yappy is P2P, so the
 * counterparty's name alone (the only thing every notification email
 * guarantees) doesn't say what the money was for — Yappy's own optional
 * "Mensaje" note fills that gap when the sender used it (see
 * lib/gmail-parsers.ts), and this catches the rest, in both directions: a
 * sent transfer is EXPENSE/paymentMethod YAPPY, a received one is
 * INCOME/importSource GMAIL (the only way an INCOME import can exist at
 * all — see gmail-parsers.ts's yappyReceivedParser).
 *
 * `cycleId` alone scopes the query — trusted to already belong to the
 * calling user, the same convention getRecurringExpensesForCycle and
 * getGoalsWithProgress use (the cycle itself was resolved through an
 * ownership-checked lookup, e.g. getOrCreateDraftCycle, before this is
 * ever called).
 */
export async function getNeedsAttentionTransactions(cycleId: string): Promise<NeedsAttentionTransaction[]> {
  const rows = await prisma.cycleTransaction.findMany({
    where: {
      cycleId,
      OR: [
        { expenseCategoryId: null },
        {
          description: null,
          OR: [{ paymentMethod: "YAPPY" }, { type: "INCOME", importSource: "GMAIL" }],
        },
      ],
    },
    select: {
      id: true,
      name: true,
      amount: true,
      type: true,
      expenseCategoryId: true,
      description: true,
      paymentMethod: true,
      importSource: true,
    },
    orderBy: { occurredAt: "desc" },
  });

  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    amount: t.amount.toNumber(),
    type: t.type,
    needsCategory: t.expenseCategoryId === null,
    needsDescription:
      t.description === null &&
      (t.paymentMethod === "YAPPY" || (t.type === "INCOME" && t.importSource === "GMAIL")),
    direction: t.type === "INCOME" ? ("received" as const) : ("sent" as const),
  }));
}
