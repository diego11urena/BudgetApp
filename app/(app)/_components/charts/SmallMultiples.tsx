/**
 * SmallMultiples: 6 thin stacked bars showing Bills/Discretionary/Goals % over time.
 * Used in Breakdown chapter 03 (Fixed vs Flexible).
 */

interface PeriodData {
  billsPct: number;
  discretionaryPct: number;
  goalsPct: number;
  label: string;
}

interface SmallMultiplesProps {
  periods: PeriodData[];
}

export default function SmallMultiples({ periods }: SmallMultiplesProps) {
  const barHeight = 52;
  const barGap = 5;

  return (
    <div className="small-multiples">
      {/* Bars */}
      <div className="small-multiples-container">
        {periods.map((period, idx) => (
          <div key={idx} className="small-multiples-bar" style={{ minHeight: barHeight }}>
            {/* Bills segment */}
            <div
              className="small-multiples-segment"
              style={{
                height: `${period.billsPct}%`,
                backgroundColor: "var(--chart-bills)",
              }}
              title={`Bills: ${period.billsPct.toFixed(0)}%`}
            />

            {/* Discretionary segment */}
            <div
              className="small-multiples-segment"
              style={{
                height: `${period.discretionaryPct}%`,
                backgroundColor: "var(--chart-discretionary)",
              }}
              title={`Discretionary: ${period.discretionaryPct.toFixed(0)}%`}
            />

            {/* Goals segment */}
            <div
              className="small-multiples-segment"
              style={{
                height: `${period.goalsPct}%`,
                backgroundColor: "var(--chart-goal)",
              }}
              title={`Goals: ${period.goalsPct.toFixed(0)}%`}
            />
          </div>
        ))}
      </div>

      {/* Captions: "6 ago" ... "Now" */}
      <div className="small-multiples-captions">
        {periods.length > 0 && (
          <>
            <span className="small-multiples-caption-start">
              {periods.length > 1 ? `${periods.length} ago` : "Earliest"}
            </span>
            <span className="small-multiples-caption-end">Now</span>
          </>
        )}
      </div>

      {/* Legend */}
      <div className="small-multiples-legend">
        <div className="small-multiples-legend-item">
          <div
            className="small-multiples-legend-swatch"
            style={{ backgroundColor: "var(--chart-bills)" }}
          />
          <span>Bills</span>
        </div>
        <div className="small-multiples-legend-item">
          <div
            className="small-multiples-legend-swatch"
            style={{ backgroundColor: "var(--chart-discretionary)" }}
          />
          <span>Discretionary</span>
        </div>
        <div className="small-multiples-legend-item">
          <div
            className="small-multiples-legend-swatch"
            style={{ backgroundColor: "var(--chart-goal)" }}
          />
          <span>Goals</span>
        </div>
      </div>
    </div>
  );
}
