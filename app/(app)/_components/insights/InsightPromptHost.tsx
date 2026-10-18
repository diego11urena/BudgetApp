import { prisma } from "@/lib/prisma";
import type { InsightPrompt } from "@/lib/insight-prompts";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { nearestMonthlyDueDate } from "@/lib/pay-date";
import { DuplicatePrompt } from "./DuplicatePrompt";
import {
  CategoryUpPrompt,
  LargePurchasePrompt,
  LeftoverPrompt,
  MissedChargePrompt,
  NewRecurringPrompt,
  PriceChangePrompt,
} from "./prompts";

/**
 * Rendered by an insight's destination screen. Loads -- ownership-scoped --
 * whatever the prompt's sheet needs and mounts it, so the sheet slides up
 * once the screen is there. Renders nothing when the data no longer exists
 * (a charge was already deleted, say). The uncategorized prompt is the
 * one exception: Home opens its existing sheet directly.
 */
export async function InsightPromptHost({ prompt, userId }: { prompt: InsightPrompt | null; userId: string }) {
  if (!prompt) return null;
  const key = prompt.key;

  switch (prompt.kind) {
    case "duplicate": {
      const rows = await prisma.cycleTransaction.findMany({
        where: { id: { in: prompt.ids }, cycle: { userId } },
        select: { id: true, name: true, amount: true, occurredAt: true },
      });
      if (rows.length !== 2) return null;
      const charges = rows.map((r) => ({ id: r.id, name: r.name, amount: r.amount.toNumber(), occurredAt: r.occurredAt.toISOString() }));
      return <DuplicatePrompt key={key} insightKey={key} charges={[charges[0], charges[1]]} />;
    }

    case "missed":
    case "price-change": {
      const recurring = await prisma.recurringExpense.findFirst({ where: { id: prompt.target, userId } });
      if (!recurring) return null;
      if (prompt.kind === "missed") {
        if (recurring.dueDay === null) return null;
        return (
          <MissedChargePrompt
            key={key}
            insightKey={key}
            recurring={{
              id: recurring.id,
              name: recurring.name,
              amount: recurring.amount.toNumber(),
              dueDate: nearestMonthlyDueDate(new Date(), recurring.dueDay!).toISOString(),
            }}
          />
        );
      }
      const cycle = await getOrCreateDraftCycle(userId);
      const charge = await prisma.cycleTransaction.findFirst({
        where: { cycleId: cycle.id, recurringExpenseId: recurring.id },
        select: { amount: true },
      });
      if (!charge) return null;
      return (
        <PriceChangePrompt
          key={key}
          insightKey={key}
          recurring={{ id: recurring.id, name: recurring.name, saved: recurring.amount.toNumber() }}
          charged={charge.amount.toNumber()}
        />
      );
    }

    case "large":
    case "new-recurring": {
      const tx = await prisma.cycleTransaction.findFirst({
        where: { id: prompt.target, cycle: { userId } },
        select: { id: true, name: true, amount: true, occurredAt: true },
      });
      if (!tx) return null;
      const transaction = { id: tx.id, name: tx.name, amount: tx.amount.toNumber(), occurredAt: tx.occurredAt.toISOString() };
      return prompt.kind === "large" ? (
        <LargePurchasePrompt key={key} insightKey={key} transaction={transaction} />
      ) : (
        <NewRecurringPrompt key={key} insightKey={key} transaction={transaction} />
      );
    }

    case "category-up": {
      const category = await prisma.expenseCategory.findFirst({ where: { id: prompt.target, userId }, select: { name: true } });
      if (!category) return null;
      return <CategoryUpPrompt key={key} insightKey={key} categoryName={category.name} />;
    }

    case "leftover": {
      const goals = await prisma.expenseCategory.findMany({
        where: { userId, type: "SAVINGS", lifetimeTargetAmount: { not: null } },
        select: { name: true },
        orderBy: { name: "asc" },
      });
      if (goals.length === 0) return null;
      return <LeftoverPrompt key={key} amount={prompt.amount} goalNames={goals.map((g) => g.name)} closedCycleId={prompt.cycle} />;
    }

    case "uncategorized":
      return null;
  }
}
