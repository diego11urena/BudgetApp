export type ProgressColorState = "good" | "warning" | "critical";

export function getProgressColorState(current: number, target: number): ProgressColorState {
  if (target <= 0) return current > 0 ? "critical" : "good";
  const percentage = (current / target) * 100;
  if (percentage >= 100) return "critical";
  if (percentage >= 70) return "warning";
  return "good";
}

export function ProgressBar({
  current,
  target,
  label,
}: {
  current: number;
  target: number;
  label?: string;
}) {
  const rawPercentage = target > 0 ? (current / target) * 100 : current > 0 ? 100 : 0;
  const displayPercentage = Math.min(rawPercentage, 100);
  const colorState = getProgressColorState(current, target);

  return (
    <div className="progress-bar">
      {label && <div className="progress-bar-label">{label}</div>}
      <div className="progress-bar-track">
        <div
          className={`progress-bar-fill progress-bar-fill--${colorState}`}
          style={{ width: `${displayPercentage}%` }}
        />
      </div>
    </div>
  );
}
