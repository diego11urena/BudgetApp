/**
 * ProgressRing: 34×34 circular progress indicator.
 * Used in Summary for in-progress goal visualization.
 * CSS custom property for stroke color, stroke-dasharray/offset for the progress.
 */

interface ProgressRingProps {
  fraction: number; // 0-1
  size?: number; // Default 34
  strokeWidth?: number; // Default 3
  colorVar?: string; // CSS var name, default "--color-savings"
}

export default function ProgressRing({
  fraction,
  size = 34,
  strokeWidth = 3,
  colorVar = "--color-savings",
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(1, fraction));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);

  return (
    <svg className="progress-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Track (background circle) */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-bg-secondary)"
        strokeWidth={strokeWidth}
      />

      {/* Progress (foreground circle, rotated -90 deg to start at top) */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={`var(${colorVar})`}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transform: "rotate(-90deg)", transformOrigin: `${size / 2}px ${size / 2}px` }}
      />
    </svg>
  );
}
