/**
 * TrendAreaChart: 320×110 stacked area chart (Bills/Discretionary over time).
 * Endpoint marker: pulsing ring+dot for LIVE, flag glyph for CLOSED.
 */

interface TrendPoint {
  label: string;
  bills: number;
  discretionary: number;
}

type CycleState = "LIVE" | "CLOSED";

interface TrendAreaChartProps {
  series: TrendPoint[];
  state: CycleState;
}

export default function TrendAreaChart({ series, state }: TrendAreaChartProps) {
  if (series.length === 0) {
    return <div className="trend-chart-empty" />;
  }

  const viewBox = "0 0 320 110";
  const width = 320;
  const height = 110;
  const padding = 8;
  const graphWidth = width - 2 * padding;
  const graphHeight = height - 2 * padding;

  // Find max for scaling (cumulative bills + discretionary).
  let maxTotal = 0;
  for (const point of series) {
    const total = point.bills + point.discretionary;
    if (total > maxTotal) maxTotal = total;
  }

  if (maxTotal === 0) maxTotal = 1; // Avoid division by zero.

  // Compute path data for stacked areas.
  let billsPath = `M ${padding} ${padding + graphHeight}`;
  let discretionaryPath = `M ${padding} ${padding + graphHeight}`;

  for (let i = 0; i < series.length; i++) {
    const x = padding + (i / (series.length - 1 || 1)) * graphWidth;
    const billsY = padding + graphHeight - (series[i].bills / maxTotal) * graphHeight;
    const discretionaryY =
      padding +
      graphHeight -
      ((series[i].bills + series[i].discretionary) / maxTotal) * graphHeight;

    billsPath += ` L ${x} ${billsY}`;
    discretionaryPath += ` L ${x} ${discretionaryY}`;
  }

  billsPath += ` L ${padding + graphWidth} ${padding + graphHeight} Z`;
  discretionaryPath += ` L ${padding + graphWidth} ${padding + graphHeight} Z`;

  // Endpoint (last point).
  const lastIndex = series.length - 1;
  const endX = padding + (lastIndex / (lastIndex || 1)) * graphWidth;
  const endBillsY =
    padding + graphHeight - (series[lastIndex].bills / maxTotal) * graphHeight;
  const endTotalY =
    padding +
    graphHeight -
    ((series[lastIndex].bills + series[lastIndex].discretionary) / maxTotal) *
      graphHeight;

  return (
    <svg
      className="trend-area-chart"
      width={width}
      height={height}
      viewBox={viewBox}
      preserveAspectRatio="none"
      aria-label="Trend: Bills vs Discretionary"
    >
      {/* Bills area (bottom) */}
      <path d={billsPath} fill="var(--chart-bills)" opacity="0.7" />

      {/* Discretionary area (top) */}
      <path d={discretionaryPath} fill="var(--chart-discretionary)" opacity="0.7" />

      {/* Endpoint marker */}
      {state === "LIVE" ? (
        // Pulsing ring + dot
        <g className="trend-endpoint-live">
          <circle
            className="trend-endpoint-pulse"
            cx={endX}
            cy={endTotalY}
            r={7}
            fill="none"
            stroke="var(--chart-discretionary)"
            strokeWidth="1.5"
            opacity="0.45"
          />
          <circle cx={endX} cy={endTotalY} r={4} fill="var(--chart-discretionary)" />
        </g>
      ) : (
        // Flag glyph (pole + triangular flag + dot)
        <g className="trend-endpoint-closed">
          {/* Vertical pole */}
          <line
            x1={endX}
            y1={endTotalY}
            x2={endX}
            y2={endTotalY - 12}
            stroke="var(--chart-discretionary)"
            strokeWidth="2"
          />

          {/* Triangular flag */}
          <path
            d={`M ${endX} ${endTotalY - 11} L ${endX + 6} ${endTotalY - 8} L ${endX} ${endTotalY - 5} Z`}
            fill="var(--chart-discretionary)"
          />

          {/* Dot at base */}
          <circle cx={endX} cy={endTotalY} r={3} fill="var(--chart-discretionary)" />
        </g>
      )}
    </svg>
  );
}
