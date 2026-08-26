import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { assessPayDateChange } from "./cycles";
import { getCycleFinancials } from "./cycle-financials";

// Real-Postgres tests for the past-quincena-editing feature — same pattern
// as cycles.concurrency.test.ts (skipped unless DATABASE_URL is set, so
// these run in the E2E CI job, not the fast no-DB one). Exercises the two
// things that are genuinely new here: writing into an already-CLOSED
// cycle actually shows up live (nothing about "closed" caches/freezes
// anything), and assessPayDateChange's reported movingCount always
// matches what a real reassignment actually moves.
describe.skipIf(!process.env.DATABASE_URL)("past-quincena editing", () => {
  let userId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `past-editing-${randomUUID()}@example.test`,
        hashedPassword: "not-a-real-hash",
      },
    });
    userId = user.id;
  });

  afterEach(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it("a transaction added to a closed cycle is immediately reflected in getCycleFinancials", async () => {
    const closedCycle = await prisma.budgetCycle.create({
      data: {
        userId,
        label: "2026-07-01",
        periodStart: new Date(2026, 6, 1),
        periodEnd: new Date(2026, 6, 15),
        status: "CLOSED",
      },
    });

    const before = await getCycleFinancials(closedCycle.id);
    expect(before.totalExpenses).toBe(0);

    // What addTransactionAction does once it's resolved the target cycle —
    // exercised directly here rather than through the "use server" action,
    // which would need auth() mocked for no benefit to what's actually
    // being verified: that nothing about a CLOSED cycle's financials is
    // cached/frozen, so a fresh write is visible on the very next read.
    await prisma.cycleTransaction.create({
      data: {
        cycleId: closedCycle.id,
        userId,
        type: "EXPENSE",
        name: "Late-added expense",
        amount: 42,
        occurredAt: new Date(2026, 6, 5),
      },
    });

    const after = await getCycleFinancials(closedCycle.id);
    expect(after.totalExpenses).toBe(42);
    expect(after.transactions).toHaveLength(1);
    expect(after.transactions[0].name).toBe("Late-added expense");
  });

  it("assessPayDateChange's movingCount matches the actual number of rows reassigned", async () => {
    // Three consecutive real quincenas: P (Jul 1-15), C (Jul 16-31), N (Aug 1-15).
    const previous = await prisma.budgetCycle.create({
      data: {
        userId,
        label: "2026-07-01",
        periodStart: new Date(2026, 6, 1),
        periodEnd: new Date(2026, 6, 15),
        status: "CLOSED",
      },
    });
    const cycle = await prisma.budgetCycle.create({
      data: {
        userId,
        label: "2026-07-16",
        periodStart: new Date(2026, 6, 16),
        periodEnd: new Date(2026, 7, 1),
        status: "CLOSED",
      },
    });
    await prisma.budgetCycle.create({
      data: {
        userId,
        label: "2026-08-01",
        periodStart: new Date(2026, 7, 1),
        status: "ACTIVE",
      },
    });

    // Two transactions in the previous cycle that would newly fall inside
    // C once C's periodStart moves back to Jul 10; one that stays in P.
    await prisma.cycleTransaction.createMany({
      data: [
        { cycleId: previous.id, userId, type: "EXPENSE", name: "a", amount: 10, occurredAt: new Date(2026, 6, 10) },
        { cycleId: previous.id, userId, type: "EXPENSE", name: "b", amount: 20, occurredAt: new Date(2026, 6, 12) },
        { cycleId: previous.id, userId, type: "EXPENSE", name: "c", amount: 30, occurredAt: new Date(2026, 6, 5) },
      ],
    });

    const newPeriodStart = new Date(2026, 6, 10);
    const assessment = await assessPayDateChange(userId, cycle, newPeriodStart);
    expect(assessment.ok).toBe(true);
    if (!assessment.ok) return;
    expect(assessment.changed).toBe(true);
    expect(assessment.direction).toBe("in");
    expect(assessment.movingCount).toBe(2);
    expect(assessment.otherCycleId).toBe(previous.id);
    expect(assessment.moveRange).not.toBeNull();

    // Apply the exact reassignment editCyclePayInfoAction's commit path
    // would, using the assessment's own moveRange/otherCycleId — the same
    // values the preview action would have shown the user.
    const sourceForMoved = assessment.otherCycleId!;
    await prisma.cycleTransaction.updateMany({
      where: { cycleId: sourceForMoved, occurredAt: assessment.moveRange! },
      data: { cycleId: cycle.id },
    });

    const movedCount = await prisma.cycleTransaction.count({
      where: { cycleId: cycle.id, occurredAt: assessment.moveRange! },
    });
    expect(movedCount).toBe(assessment.movingCount);

    const remainingInPrevious = await prisma.cycleTransaction.count({ where: { cycleId: previous.id } });
    expect(remainingInPrevious).toBe(1); // only "c" (Jul 5) should be left
  });

  it("rejects a pay-date change that would overlap the previous cycle's boundary", async () => {
    const previous = await prisma.budgetCycle.create({
      data: {
        userId,
        label: "2026-07-01",
        periodStart: new Date(2026, 6, 1),
        periodEnd: new Date(2026, 6, 15),
        status: "CLOSED",
      },
    });
    const cycle = await prisma.budgetCycle.create({
      data: {
        userId,
        label: "2026-07-16",
        periodStart: new Date(2026, 6, 16),
        periodEnd: new Date(2026, 7, 1),
        status: "CLOSED",
      },
    });
    await prisma.cycleTransaction.create({
      data: { cycleId: previous.id, userId, type: "EXPENSE", name: "a", amount: 10, occurredAt: new Date(2026, 6, 5) },
    });

    // On or before the previous cycle's own periodStart -- an outright conflict.
    const assessment = await assessPayDateChange(userId, cycle, previous.periodStart);
    expect(assessment.ok).toBe(false);
    if (assessment.ok) return;
    expect(assessment.error).toContain("Jul 1");

    // Nothing should have moved as a side effect of merely assessing this.
    const stillInPrevious = await prisma.cycleTransaction.count({ where: { cycleId: previous.id } });
    expect(stillInPrevious).toBe(1);
  });
});
