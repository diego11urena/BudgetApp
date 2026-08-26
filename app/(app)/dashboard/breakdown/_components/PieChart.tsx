import type { BreakdownSlice } from "@/lib/paycheck-breakdown";
import { formatCurrency } from "@/lib/format";

const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 84;
const POP_OUT = 6;

function polarToCartesian(angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + RADIUS * Math.cos(rad), y: CENTER + RADIUS * Math.sin(rad) };
}

function wedgePath(startAngle: number, endAngle: number): string {
  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(endAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
}

/** Direction to nudge a selected wedge outward, along its own mid-angle. */
function popOutOffset(startAngle: number, endAngle: number) {
  const midAngle = (startAngle + endAngle) / 2;
  const rad = ((midAngle - 90) * Math.PI) / 180;
  return { x: POP_OUT * Math.cos(rad), y: POP_OUT * Math.sin(rad) };
}

export function PieChart({
  slices,
  selectedKey,
  onSelect,
}: {
  slices: BreakdownSlice[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  // A single 100% slice can't form a valid wedge path (start === end point
  // once the sweep is a full circle) — render a plain circle instead.
  if (slices.length === 1) {
    const slice = slices[0];
    return (
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="pie-chart" role="group" aria-label="Paycheck breakdown chart">
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill={`var(${slice.colorVar})`}
          role="button"
          tabIndex={0}
          aria-label={`${slice.label}, ${formatCurrency(slice.amount)}, ${Math.round(slice.percentage)}%`}
          aria-pressed={selectedKey === slice.key}
          onClick={() => onSelect(slice.key)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(slice.key);
            }
          }}
        />
      </svg>
    );
  }

  const wedges = slices.reduce<Array<{ slice: BreakdownSlice; startAngle: number; endAngle: number }>>(
    (acc, slice) => {
      const cursor = acc.length > 0 ? acc[acc.length - 1].endAngle : 0;
      const startAngle = cursor;
      const endAngle = cursor + (slice.percentage / 100) * 360;
      return [...acc, { slice, startAngle, endAngle }];
    },
    [],
  );

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="pie-chart" role="group" aria-label="Paycheck breakdown chart">
      {wedges.map(({ slice, startAngle, endAngle }) => {
        const isSelected = selectedKey === slice.key;
        const offset = isSelected ? popOutOffset(startAngle, endAngle) : { x: 0, y: 0 };
        return (
          <path
            key={slice.key}
            d={wedgePath(startAngle, endAngle)}
            fill={`var(${slice.colorVar})`}
            className={`pie-chart-slice ${isSelected ? "is-selected" : ""} ${selectedKey && !isSelected ? "is-dimmed" : ""}`}
            style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
            role="button"
            tabIndex={0}
            aria-label={`${slice.label}, ${formatCurrency(slice.amount)}, ${Math.round(slice.percentage)}%`}
            aria-pressed={isSelected}
            onClick={() => onSelect(slice.key)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(slice.key);
              }
            }}
          />
        );
      })}
    </svg>
  );
}
