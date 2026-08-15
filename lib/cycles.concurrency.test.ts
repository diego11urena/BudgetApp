import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { getOrCreateDraftCycle } from "./cycles";

// This exercises the actual database constraint (a partial unique index —
// see prisma/migrations/20260815035814_race_condition_partial_unique_indexes)
// that getOrCreateDraftCycle relies on to stay race-safe under real
// concurrent requests, not just React's per-request cache(). It needs a
// live Postgres with that migration applied, so it's skipped wherever
// DATABASE_URL isn't set (the fast typecheck/lint/unit-test CI job has no
// DB) and only actually runs locally or in the E2E CI job, which does.
describe.skipIf(!process.env.DATABASE_URL)("getOrCreateDraftCycle concurrency", () => {
  let userId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `cycles-concurrency-${randomUUID()}@example.test`,
        hashedPassword: "not-a-real-hash",
      },
    });
    userId = user.id;
  });

  afterEach(async () => {
    // Cascades to any BudgetCycle rows created during the test.
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it("creates exactly one cycle when called concurrently", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => getOrCreateDraftCycle(userId)),
    );

    const cycles = await prisma.budgetCycle.findMany({ where: { userId } });
    expect(cycles).toHaveLength(1);

    // Every concurrent caller must have gotten back that same row, not a
    // duplicate it created for itself.
    for (const result of results) {
      expect(result.id).toBe(cycles[0].id);
    }
  });
});
