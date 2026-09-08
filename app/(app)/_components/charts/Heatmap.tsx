"use client";

import { useState, useMemo } from "react";

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
  // 7-column grid layout — pad/fill to complete the last week if needed.
  const weeks: HeatmapDay[][] = [];
  let currentWeek: HeatmapDay[] = [];

  for (const day of days) {
    // Get weekday (0 = Sun, 1 = Mon, ..., 6 = Sat)
    const weekday = new Date(day.date + "T00:00:00").getDay();

    // If we have days from a previous week and we've wrapped (weekday < previous weekday),
    // or this is the first day and it's not Sunday, backfill.
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
      <div className="heatmap-grid">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="heatmap-week">
            {week.map((day, dayIdx) => (
              <button
                key={`${weekIdx}-${dayIdx}`}
                className={`heatmap-cell ${
                  day.disabled ? "heatmap-cell--disabled" : ""
                } ${selectedDate === day.date ? "heatmap-cell--selected" : ""}`}
                onClick={() => handleCellClick(day.date)}
                title={day.date ? `${day.date} · $${day.total.toFixed(2)}` : ""}
                style={{
                  backgroundColor: day.disabled
                    ? "transparent"
                    : `var(${colorVar}-${day.bucket})`,
                  cursor: day.disabled ? "default" : "pointer",
                }}
                disabled={day.disabled}
              />
            ))}
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
