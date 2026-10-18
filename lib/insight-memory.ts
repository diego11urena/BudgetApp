import { prisma } from "@/lib/prisma";
import type { InsightMemoryRecord } from "@/lib/insights";

/** Every stored insight response for a user, as generateInsights reads them. */
export async function getInsightMemory(userId: string): Promise<InsightMemoryRecord[]> {
  return prisma.insightMemory.findMany({
    where: { userId },
    select: { key: true, fingerprint: true, until: true },
  });
}

/** Records what the user did about an insight. Upserted by key: a later response replaces an earlier one. */
export function rememberInsight(
  userId: string,
  memory: { key: string; fingerprint: string; response?: string; until?: Date | null },
) {
  const data = { fingerprint: memory.fingerprint, response: memory.response ?? "dismissed", until: memory.until ?? null };
  return prisma.insightMemory.upsert({
    where: { userId_key: { userId, key: memory.key } },
    create: { userId, key: memory.key, ...data },
    update: data,
  });
}
