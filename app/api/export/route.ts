import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { summarizeCycleFinancials, TRANSACTION_SELECT } from "@/lib/cycle-financials";

const CYCLE_COUNT = 6;
const COLUMNS = ["cycle", "cycle_start", "cycle_end", "row_type", "date", "name", "amount", "category", "payment_method", "description", "cycle_balance"];

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

// Quote every field; a leading = + - @ would run as a formula in Excel/Sheets.
function cell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  const safe = /^[=+\-@]/.test(text) && typeof value === "string" ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * CSV of the signed-in user's last 6 cycles (open one included), long format:
 * one PAYCHECK row per income entry, one row per transaction, and a CYCLE_END
 * row carrying that cycle's balance (income - expenses - savings, same math as
 * the dashboard; for the open cycle it's the balance so far). Deliberately
 * leaves out user id, email and Gmail message ids.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const cycles = await prisma.budgetCycle.findMany({
    where: { userId: session.user.id },
    orderBy: { periodStart: "desc" },
    take: CYCLE_COUNT,
    select: {
      label: true,
      periodStart: true,
      periodEnd: true,
      incomeEntries: { select: { netAmount: true, receivedAt: true } },
      transactions: { select: TRANSACTION_SELECT, orderBy: { occurredAt: "asc" } },
    },
  });

  const rows: (string | number | null)[][] = [];
  for (const c of cycles.reverse()) {
    const head = [c.label, day(c.periodStart), day(c.periodEnd)];
    for (const e of c.incomeEntries) {
      rows.push([...head, "PAYCHECK", day(e.receivedAt), "", e.netAmount.toNumber(), "", "", "", ""]);
    }
    for (const tx of c.transactions) {
      rows.push([...head, tx.type, day(tx.occurredAt), tx.name, tx.amount.toNumber(), tx.expenseCategory?.name ?? "", tx.paymentMethod ?? "", tx.description ?? "", ""]);
    }
    const { amountLeft } = summarizeCycleFinancials(c.incomeEntries, c.transactions.map((tx) => ({ ...tx, cycleId: "" })));
    rows.push([...head, "CYCLE_END", "", "", "", "", "", "", Number(amountLeft.toFixed(2))]);
  }

  const csv = [COLUMNS.map(cell), ...rows.map((r) => r.map(cell))].map((r) => r.join(",")).join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="balboa-last-6-cycles.csv"',
    },
  });
}
