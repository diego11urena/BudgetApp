/**
 * One-off cleanup: removes the throwaway accounts the Playwright suite
 * creates (`e2e-<timestamp>-<random>@example.com`, see
 * tests/e2e/helpers.ts's signUpAndOnboard) from whatever database
 * DATABASE_URL points at.
 *
 * This exists because the e2e suite was, for a while, running against the
 * production Neon database rather than localhost -- `.env.local` (pulled
 * by `vercel env pull`) sets DATABASE_URL to production, and Next.js loads
 * `.env.local` at higher precedence than `.env`, so `next dev` picked up
 * production while the Prisma CLI (via prisma.config.ts's own
 * `import "dotenv/config"`, which reads only `.env`) stayed on localhost.
 * tests/e2e/global-setup.ts now refuses to run the suite against a
 * non-local database, so this should never be needed a second time.
 *
 * Run:
 *   DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2- | tr -d '"')" \
 *     npx tsx scripts/cleanup-e2e-users.ts          # preview only
 *   ... npx tsx scripts/cleanup-e2e-users.ts --apply   # actually delete
 *
 * Deletes nothing without --apply. BudgetCycle cascades from User
 * (onDelete: Cascade in schema.prisma), so removing the user removes its
 * cycles and their transactions with it.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "@/app/generated/prisma/client";

/**
 * Deliberately requires BOTH halves of the generated address, not just the
 * `e2e-` prefix -- a real account could plausibly start with "e2e" but
 * never also end in @example.com, a domain reserved by RFC 2606 precisely
 * so it can't belong to anyone.
 */
const E2E_USERS: Prisma.UserWhereInput = {
  AND: [{ email: { startsWith: "e2e-" } }, { email: { endsWith: "@example.com" } }],
};

/** Shows enough of an address to recognise it, without printing it in full. */
function mask(email: string): string {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 3)}***@${domain}`;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const [matched, cycles, transactions, survivors] = await Promise.all([
    prisma.user.count({ where: E2E_USERS }),
    prisma.budgetCycle.count({ where: { user: E2E_USERS } }),
    prisma.cycleTransaction.count({ where: { cycle: { user: E2E_USERS } } }),
    prisma.user.findMany({
      where: { NOT: E2E_USERS },
      select: { email: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  console.log(`${apply ? "Deleting" : "Would delete"}: ${matched} users, ${cycles} cycles, ${transactions} transactions`);
  console.log(`Keeping: ${survivors.length} accounts`);
  for (const u of survivors) {
    console.log(`  - ${mask(u.email)}  (created ${u.createdAt.toISOString().slice(0, 10)})`);
  }

  if (!apply) {
    console.log("\nPreview only. Re-run with --apply to delete.");
    await prisma.$disconnect();
    return;
  }

  const { count } = await prisma.user.deleteMany({ where: E2E_USERS });
  const [orphanCycles, orphanTx, remaining] = await Promise.all([
    prisma.budgetCycle.count({ where: { user: E2E_USERS } }),
    prisma.cycleTransaction.count({ where: { cycle: { user: E2E_USERS } } }),
    prisma.user.count(),
  ]);

  console.log(`\nDeleted ${count} users. ${remaining} accounts remain.`);
  console.log(`Orphaned rows left behind: ${orphanCycles} cycles, ${orphanTx} transactions (both should be 0).`);
  await prisma.$disconnect();
}

main();
