import { formatUSD } from "@/lib/format";
import { computeQuincenaPace } from "@/lib/quincena-pace";
import { justGotPaidAction } from "../actions";

export function HeroCard({
  amountLeft,
  periodStart,
  totalExpenses,
}: {
  amountLeft: number;
  periodStart: Date;
  totalExpenses: number;
}) {
  const isPositive = amountLeft >= 0;
  const pace = computeQuincenaPace({ periodStart, now: new Date(), amountLeft, totalExpenses });

  return (
    <div className="hero-card">
      <p className="hero-label">Available to spend</p>
      <p className={`hero-value ${isPositive ? "hero-value--good" : "hero-value--critical"}`}>
        {formatUSD(amountLeft)}
      </p>
      <p className="hero-subtitle">Remaining this Quincena</p>
      <p className={`hero-pace ${pace.isOverPace ? "hero-pace--warning" : ""}`}>
        {formatUSD(amountLeft)} left · {pace.daysRemaining} day{pace.daysRemaining === 1 ? "" : "s"} left ·{" "}
        {pace.isLastDay ? "Last day of this quincena" : `~${formatUSD(pace.perDay)}/day`}
      </p>
      <form action={justGotPaidAction}>
        <button type="submit" className="hero-action-link">
          I just got paid →
        </button>
      </form>
    </div>
  );
}
