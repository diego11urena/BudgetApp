import { getBudgetUsage, type BudgetStatus } from "@/lib/budget-status";

export type ProgressColorState = BudgetStatus;

/** Delegates to the same good/warning/critical thresholds every other percent-of-target bar in the app uses (see lib/budget-status.ts) -- this used to define its own, disagreeing cutoffs. */
export function getProgressColorState(current: number, target: number): ProgressColorState {
  return getBudgetUsage(current, target).state;
}

export function ProgressBar({
  current,
  target,
  label,
  colorState,
}: {
  current: number;
  target: number;
  label?: string;
  /** Overrides the default good/warning/critical thresholds — e.g. budget bars use their own (see lib/budget-status.ts). */
  colorState?: ProgressColorState;
}) {
  const rawPercentage = target > 0 ? (current / target) * 100 : current > 0 ? 100 : 0;
  const displayPercentage = Math.min(rawPercentage, 100);
  const resolvedColorState = colorState ?? getProgressColorState(current, target);

  return (
    <div className="progress-bar">
      {label && <div className="progress-bar-label">{label}</div>}
      <div
        className="progress-bar-track"
        role="img"
        aria-label={`${Math.round(displayPercentage)}%`}
      >
        <div
          className={`progress-bar-fill progress-bar-fill--${resolvedColorState}`}
          style={{ width: `${displayPercentage}%` }}
        />
      </div>
    </div>
  );
}
