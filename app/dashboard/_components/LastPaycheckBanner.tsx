function formatUSD(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function LastPaycheckBanner({ amountLeft }: { amountLeft: number }) {
  const isPositive = amountLeft >= 0;

  return (
    <div className={`banner ${isPositive ? "banner--good" : "banner--critical"}`}>
      {isPositive
        ? `You saved ${formatUSD(amountLeft)} from your last paycheck.`
        : `You overspent ${formatUSD(Math.abs(amountLeft))} from your last paycheck.`}
    </div>
  );
}
