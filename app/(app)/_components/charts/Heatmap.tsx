"use client";

import { useMemo } from "react";
import { useLocale } from "@/app/_components/LocaleProvider";

/** A single heatmap cell representing one day. */
export interface HeatmapDay {
  date: string; // ISO date "2026-08-01"
  bucket: 0 | 1 | 2 | 3 | 4; // 0 = no spend, 1-4 = percentile buckets
  total: number; // Spend amount for display/sorting
  disabled?: boolean; // Greyed out (LIVE mode, day not elapsed)
}

interface HeatmapProps {
  days: HeatmapDay[];
  selectedDate: string | null;
  onSelectDay: (date: string) => void;
  colorVar?: string; // CSS var prefix, default "--heatmap"
}

export default function Heatmap({
  days,
  selectedDate,
  onSelectDay,
  colorVar = "--heatmap",
}: HeatmapProps) {
  const locale = useLocale();

  // Narrow weekday letters (M T W T F S S in English, L M M J V S D in
  // Spanish) for the header row above the grid. MONDAY-first, which the
  // design spec asks for ("7-col grid, M-S header") and screens/20 draws.
  // Jan 1 1970 was a Thursday, so Jan 5 1970 is the first Monday on or
  // after the epoch.
  //
  // timeZone: "UTC" is load-bearing, not decoration. Date.UTC builds the
  // instant correctly, but Intl formats it in the RUNTIME's zone unless
  // told otherwise -- so on any machine west of UTC, Jan 5 00:00 UTC is
  // still Jan 4 locally and the whole row silently shifts back to
  // Sunday-first, while the grid below stays Monday-based. The two
  // disagreeing puts every cell one column off its own weekday.
  const weekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-US", {
      weekday: "narrow",
      timeZone: "UTC",
    });
    return Array.from({ length: 7 }, (_, i) => formatter.format(new Date(Date.UTC(1970, 0, 5 + i))));
  }, [locale]);

  // 7-column grid layout — pad/fill to complete the last week if needed.
  const weeks: HeatmapDay[][] = [];
  let currentWeek: HeatmapDay[] = [];

  for (const day of days) {
    // Column index with MONDAY as column 0, so the grid lines up under the
    // M-S header above. Date.getDay() is Sunday-based (0=Sun..6=Sat), and
    // (d + 6) % 7 rotates that to Monday-based (Mon=0..Sun=6) -- the two
    // have to agree or every cell sits one column off its own weekday.
    const weekday = (new Date(day.date + "T00:00:00").getDay() + 6) % 7;

    // Backfill blanks so the period's first day lands in its own column.
    if (currentWeek.length === 0 && weekday > 0) {
      // Backfill empty days at the start of the first week.
      for (let i = 0; i < weekday; i++) {
        currentWeek.push({
          date: "",
          bucket: 0,
          total: 0,
          disabled: true,
        });
      }
    }

    currentWeek.push(day);

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Pad last week with empty cells.
  while (currentWeek.length > 0 && currentWeek.length < 7) {
    currentWeek.push({
      date: "",
      bucket: 0,
      total: 0,
      disabled: true,
    });
  }
  if (currentWeek.length === 7) {
    weeks.push(currentWeek);
  }

  const handleCellClick = (date: string) => {
    if (date && !date.startsWith("0000")) {
      onSelectDay(date);
    }
  };

  return (
    <div className="heatmap">
      <div className="heatmap-weekday-header">
        {weekdayLabels.map((label, i) => (
          <span key={i} className="heatmap-weekday-label">
            {label}
          </span>
        ))}
      </div>

      <div className="heatmap-grid">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="heatmap-week">
            {week.map((day, dayIdx) => {
              // Three kinds of cell, and they look different on purpose:
              //  - a real day: bucket fill + its date number;
              //  - a LIVE future day (has a date, disabled): --surface
              //    fill with a dashed border, so it reads as "hasn't
              //    happened yet" rather than as a very small amount on
              //    the same heat ramp;
              //  - a padding cell before/after the period (no date at
              //    all): present only to keep the weekday columns
              //    aligned, so it draws nothing.
              const dayNumber = day.date ? Number(day.date.slice(-2)) : null;
              const isPadding = !day.date;
              const isFuture = !isPadding && day.disabled;
              return (
                <button
                  key={`${weekIdx}-${dayIdx}`}
                  className={`heatmap-cell ${isPadding ? "heatmap-cell--empty" : ""} ${
                    isFuture ? "heatmap-cell--disabled" : ""
                  } ${selectedDate === day.date ? "heatmap-cell--selected" : ""}`}
                  onClick={() => handleCellClick(day.date)}
                  title={day.date ? `${day.date} · $${day.total.toFixed(2)}` : ""}
                  // Only a real day gets an inline bucket fill; the other
                  // two take their appearance from their class, which an
                  // inline background would otherwise win against.
                  style={
                    isPadding || isFuture ? undefined : { backgroundColor: `var(${colorVar}-${day.bucket})` }
                  }
                  disabled={day.disabled}
                >
                  {dayNumber !== null && (
                    <span
                      className="heatmap-cell-date"
                      style={isFuture ? undefined : { color: `var(${colorVar}-text-${day.bucket})` }}
                    >
                      {dayNumber}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend: 5 swatches + label */}
      <div className="heatmap-legend">
        <span className="heatmap-legend-label">Less</span>
        {[0, 1, 2, 3, 4].map((bucket) => (
          <div
            key={bucket}
            className="heatmap-legend-swatch"
            style={{
              backgroundColor: `var(${colorVar}-${bucket})`,
            }}
          />
        ))}
        <span className="heatmap-legend-label">More</span>
      </div>
    </div>
  );
}
