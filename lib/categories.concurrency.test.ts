import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { getOrCreateCategory } from "./categories";

// Same shape as cycles.concurrency.test.ts: getOrCreateCategory's
// case-insensitive lookup can't be backed by ExpenseCategory's schema-native
// @@unique([userId, name, type]) (case-sensitive), so the actual guard
// against a concurrent "Rent" + "rent" double-create is a separate
// expression unique index — see
// prisma/migrations/20260815035814_race_condition_partial_unique_indexes.
// Needs a live Postgres with that migration applied.
describe.skipIf(!process.env.DATABASE_URL)("getOrCreateCategory concurrency", () => {
  let userId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `categories-concurrency-${randomUUID()}@example.test`,
        hashedPassword: "not-a-real-hash",
      },
    });
    userId = user.id;
  });

  afterEach(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it("creates exactly one category when the same name races under different casing", async () => {
    // A handful of concurrent calls per spelling isn't enough to reliably
    // land two of them inside each other's find-then-create window — with
    // only 2-3 racers, Promise.all's own scheduling tends to let the first
    // one's create() finish before the second's findFirst even fires,
    // masking the race in a way that would make this a flaky negative
    // control. 30 calls across 3 spellings reproduces it consistently.
    const spellings = Array.from({ length: 30 }, (_, i) => ["Rent", "rent", "RENT"][i % 3]);
    const results = await Promise.all(
      spellings.map((name) => getOrCreateCategory(prisma, userId, name, "EXPENSE")),
    );

    const categories = await prisma.expenseCategory.findMany({
      where: { userId, type: "EXPENSE" },
    });
    expect(categories).toHaveLength(1);

    for (const result of results) {
      expect(result.id).toBe(categories[0].id);
    }
  });
});
