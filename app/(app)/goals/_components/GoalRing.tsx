const SIZE = 88;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** A saved/target ring — plain SVG, no charting library. Percentage renders as HTML text centered over it (more reliable than SVG <text> for font metrics/weight). */
export function GoalRing({ percentage, complete }: { percentage: number; complete: boolean }) {
  const clamped = Math.min(Math.max(percentage, 0), 100);
  const offset = CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <div className="goal-ring-wrap">
      <svg
        className="goal-ring"
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`${Math.round(percentage)}% saved`}
      >
        <circle
          className="goal-ring-track"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeWidth={STROKE}
          fill="none"
        />
        <circle
          className="goal-ring-fill"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="goal-ring-label">{complete ? "🎉" : `${Math.round(percentage)}%`}</span>
    </div>
  );
}
