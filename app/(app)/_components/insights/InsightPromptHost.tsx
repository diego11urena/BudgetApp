import { prisma } from "@/lib/prisma";
import type { InsightPrompt } from "@/lib/insight-prompts";
import { DuplicatePrompt } from "./DuplicatePrompt";

/**
 * Rendered by an insight's destination screen. Loads -- ownership-scoped --
 * whatever the prompt's sheet needs and mounts it, so the sheet slides up
 * once the screen is there. Renders nothing when the data no longer exists
 * (a charge was already deleted, say).
 */
export async function InsightPromptHost({ prompt, userId }: { prompt: InsightPrompt | null; userId: string }) {
  if (!prompt) return null;

  if (prompt.kind === "duplicate") {
    const rows = await prisma.cycleTransaction.findMany({
      where: { id: { in: prompt.ids }, cycle: { userId } },
      select: { id: true, name: true, amount: true, occurredAt: true },
    });
    if (rows.length !== 2) return null;
    const charges = rows.map((r) => ({ id: r.id, name: r.name, amount: r.amount.toNumber(), occurredAt: r.occurredAt.toISOString() }));
    return <DuplicatePrompt key={prompt.key} insightKey={prompt.key} charges={[charges[0], charges[1]]} />;
  }

  return null;
}
