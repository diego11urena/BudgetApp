import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import {
  closeCycleAndStartNext,
  deleteCycleIncomeEntry,
  getOrCreateDraftCycle,
  logPaycheckToOpenCycle,
  updateCycleIncomeEntry,
} from "./cycles";
import { getCycleFinancials } from "./cycle-financials";

function panama(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
}

// Real-Postgres tests for the decoupled paycheck-logging/cycle-closing
// core (Phase P2) -- same pattern as cycles.concurrency.test.ts (skipped
// unless DATABASE_URL is set). Exercises the two things this phase
// actually changed: closeCycleAndStartNext's new carryIncomeForward
// option, and logPaycheckToOpenCycle's additive (never overwriting)
// multi-paycheck logging -- the literal mechanism behind the acceptance
// criteria ("two $800 paychecks in one MONTHLY cycle sum to $1,600
// without the cycle resetting").
describe.skipIf(!process.env.DATABASE_URL)("decoupled paycheck logging", () => {
  let userId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `paycheck-logging-${randomUUID()}@example.test`,
        hashedPassword: "not-a-real-hash",
      },
    });
    userId = user.id;
    await prisma.incomeSource.create({
      data: { userId, netPayAmount: 800 },
    });
  });

  afterEach(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  describe("closeCycleAndStartNext", () => {
    it("defaults to seeding the new cycle's income from IncomeSource.netPayAmount, unchanged from today's QUINCENAL behavior", async () => {
      await getOrCreateDraftCycle(userId);
      const { newCycle } = await closeCycleAndStartNext(userId, panama(2026, 9, 1));

      const financials = await getCycleFinancials(newCycle.id);
      expect(financials.baseIncome).toBe(800);
    });

    it("carryIncomeForward: false starts the new cycle at zero income -- the MONTHLY 'Close this month' rollover", async () => {
      await getOrCreateDraftCycle(userId);
      const { newCycle } = await closeCycleAndStartNext(userId, panama(2026, 9, 1), {
        carryIncomeForward: false,
      });

      const financials = await getCycleFinancials(newCycle.id);
      expect(financials.baseIncome).toBe(0);

      const entries = await prisma.cycleIncomeEntry.findMany({ where: { cycleId: newCycle.id } });
      expect(entries).toHaveLength(0);
    });
  });

  describe("logPaycheckToOpenCycle", () => {
    it("reproduces the acceptance-criteria example: two $800 paychecks in one cycle sum to $1,600, without closing it", async () => {
      const cycle = await getOrCreateDraftCycle(userId);

      await logPaycheckToOpenCycle(userId, 800, panama(2026, 9, 3));
      await logPaycheckToOpenCycle(userId, 800, panama(2026, 9, 17));

      const financials = await getCycleFinancials(cycle.id);
      expect(financials.baseIncome).toBe(1600);

      // The cycle never closed or rolled over -- still the same row, still open.
      const stillOpenCycles = await prisma.budgetCycle.findMany({ where: { userId } });
      expect(stillOpenCycles).toHaveLength(1);
      expect(stillOpenCycles[0].id).toBe(cycle.id);
      expect(stillOpenCycles[0].status).not.toBe("CLOSED");

      const entries = await prisma.cycleIncomeEntry.findMany({ where: { cycleId: cycle.id } });
      expect(entries).toHaveLength(2);
    });

    it("updates IncomeSource.netPayAmount to the last-logged amount, as a prefill convenience only", async () => {
      await getOrCreateDraftCycle(userId);
      await logPaycheckToOpenCycle(userId, 950, panama(2026, 9, 3));

      const incomeSource = await prisma.incomeSource.findFirstOrThrow({ where: { userId } });
      expect(incomeSource.netPayAmount.toNumber()).toBe(950);
    });
  });

  describe("updateCycleIncomeEntry / deleteCycleIncomeEntry", () => {
    it("corrects one logged paycheck's amount and date in place, without touching the cycle or other entries", async () => {
      const cycle = await getOrCreateDraftCycle(userId);
      await logPaycheckToOpenCycle(userId, 800, panama(2026, 9, 3));
      const second = await logPaycheckToOpenCycle(userId, 800, panama(2026, 9, 17));

      await updateCycleIncomeEntry(prisma, second.id, 825, panama(2026, 9, 18));

      const financials = await getCycleFinancials(cycle.id);
      expect(financials.baseIncome).toBe(1625);

      const updated = await prisma.cycleIncomeEntry.findUniqueOrThrow({ where: { id: second.id } });
      expect(updated.receivedAt.getTime()).toBe(panama(2026, 9, 18).getTime());
    });

    it("removes one logged paycheck entirely, leaving the other intact", async () => {
      const cycle = await getOrCreateDraftCycle(userId);
      const first = await logPaycheckToOpenCycle(userId, 800, panama(2026, 9, 3));
      await logPaycheckToOpenCycle(userId, 800, panama(2026, 9, 17));

      await deleteCycleIncomeEntry(prisma, first.id);

      const financials = await getCycleFinancials(cycle.id);
      expect(financials.baseIncome).toBe(800);

      const entries = await prisma.cycleIncomeEntry.findMany({ where: { cycleId: cycle.id } });
      expect(entries).toHaveLength(1);
    });
  });
});
