import { formatUSD } from "@/lib/format";
import { justGotPaidAction } from "../actions";

export function HeroCard({ amountLeft }: { amountLeft: number }) {
  const isPositive = amountLeft >= 0;

  return (
    <div className="hero-card">
      <p className="hero-label">Available to spend</p>
      <p className={`hero-value ${isPositive ? "hero-value--good" : "hero-value--critical"}`}>
        {formatUSD(amountLeft)}
      </p>
      <p className="hero-subtitle">this pay cycle</p>
      <form action={justGotPaidAction}>
        <button type="submit" className="hero-action-link">
          I just got paid →
        </button>
      </form>
    </div>
  );
}
