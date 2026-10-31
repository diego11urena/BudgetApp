import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { ignoreImportedMessages, unignoreMessage } from "./gmail-ignored";

// Needs a live Postgres, like the other *.concurrency tests.
describe.skipIf(!process.env.DATABASE_URL)("ignoreImportedMessages", () => {
  let userId: string;
  let cycleId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({ data: { email: `gmail-ignored-${randomUUID()}@example.test` } });
    userId = user.id;
    const cycle = await prisma.budgetCycle.create({ data: { userId, label: "t", periodStart: new Date() } });
    cycleId = cycle.id;
    const base = { cycleId, userId, type: "EXPENSE" as const, amount: "5", occurredAt: new Date() };
    await prisma.cycleTransaction.createMany({
      data: [
        { ...base, name: "imported", importSource: "GMAIL", sourceMessageId: "m1" },
        { ...base, name: "manual", importSource: "MANUAL" },
      ],
    });
  });

  afterEach(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it("remembers only the imported transactions' message ids, once, and can forget them", async () => {
    await ignoreImportedMessages(prisma, userId, {});
    await ignoreImportedMessages(prisma, userId, { cycle: { id: cycleId } });
    expect((await prisma.gmailIgnoredMessage.findMany({ where: { userId } })).map((m) => m.messageId)).toEqual(["m1"]);

    await unignoreMessage(prisma, userId, "m1");
    expect(await prisma.gmailIgnoredMessage.count({ where: { userId } })).toBe(0);
  });
});
