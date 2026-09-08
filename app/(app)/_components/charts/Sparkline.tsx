/**
 * Sparkline: 6-point polyline + endpoint dot (112×28 SVG).
 * Used in Summary for last-N-periods trend visualization.
 */

interface SparklineProps {
  points: number[];
  colorVar?: string; // CSS var name, e.g. "--color-savings"
}

export default function Sparkline({ points, colorVar = "--color-savings" }: SparklineProps) {
  if (points.length === 0) {
    return <div className="sparkline-empty" />;
  }

  const width = 112;
  const height = 28;
  const padding = 4;
  const graphWidth = width - 2 * padding;
  const graphHeight = height - 2 * padding;

  // Find min/max for scaling.
  const minValue = Math.min(...points);
  const maxValue = Math.max(...points);
  const range = maxValue - minValue === 0 ? 1 : maxValue - minValue;

  // Map points to SVG coordinates.
  const polylinePoints = points
    .map((value, index) => {
      const x = padding + (index / (points.length - 1 || 1)) * graphWidth;
      const y = padding + graphHeight - ((value - minValue) / range) * graphHeight;
      return `${x},${y}`;
    })
    .join(" ");

  // Endpoint position (last point).
  const lastIndex = points.length - 1;
  const endX = padding + (lastIndex / (lastIndex || 1)) * graphWidth;
  const endY = padding + graphHeight - ((points[lastIndex] - minValue) / range) * graphHeight;

  return (
    <svg
      className="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-label={`Trend: ${points.join(", ")}`}
    >
      {/* Polyline */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={`var(${colorVar})`}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Endpoint dot */}
      <circle cx={endX} cy={endY} r="2" fill={`var(${colorVar})`} />
    </svg>
  );
}
