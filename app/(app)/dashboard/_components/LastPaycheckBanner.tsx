import { formatCurrency } from "@/lib/format";

export function LastPaycheckBanner({ amountLeft }: { amountLeft: number }) {
  const isPositive = amountLeft >= 0;

  return (
    <div className={`banner ${isPositive ? "banner--good" : "banner--critical"}`}>
      {isPositive
        ? `You saved ${formatCurrency(amountLeft)} from your last paycheck.`
        : `You overspent ${formatCurrency(Math.abs(amountLeft))} from your last paycheck.`}
    </div>
  );
}
