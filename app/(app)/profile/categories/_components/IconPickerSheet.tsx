"use client";

import { useEffect, useRef, useState } from "react";
import { useModalFocus } from "../../../_components/useModalFocus";
import { getIconGroups, searchIcons, type IconEntry } from "@/lib/category-icon-library";

const GROUPS = getIconGroups();

/**
 * Search at top; empty query shows all 12 groups (each its own small,
 * scannable grid) so nothing forces scrolling through hundreds of icons at
 * once, non-empty query flattens to matches across every group (name,
 * group, or keyword — "car" surfaces Transportation, "dog" surfaces Pets).
 */
export function IconPickerSheet({
  onPick,
  onClose,
}: {
  onPick: (iconName: string) => void;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  useModalFocus(sheetRef, handleClose, null);

  const trimmed = query.trim();
  const searchResults = trimmed ? searchIcons(trimmed) : null;

  function renderGrid(icons: IconEntry[]) {
    return (
      <div className="icon-picker-grid">
        {icons.map((entry) => (
          <button
            key={entry.name}
            type="button"
            className="icon-picker-item"
            onClick={() => onPick(entry.name)}
            aria-label={entry.name}
            title={entry.name}
          >
            <entry.icon size={20} aria-hidden="true" />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`sheet-backdrop ${visible ? "is-visible" : ""}`} onClick={handleClose} role="presentation">
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={`sheet icon-picker-sheet ${visible ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Choose an icon"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <h2 style={{ textAlign: "center", marginBottom: "0.75rem" }}>Choose an icon</h2>

        <input
          type="text"
          className="transaction-filters-search"
          placeholder="Search icons…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search icons"
          autoFocus
          style={{ marginBottom: "0.75rem" }}
        />

        <div className="icon-picker-scroll">
          {searchResults ? (
            searchResults.length > 0 ? (
              renderGrid(searchResults)
            ) : (
              <p className="field-hint">No icons match &quot;{trimmed}&quot;.</p>
            )
          ) : (
            GROUPS.map(({ group, icons }) => (
              <div key={group} className="icon-picker-group">
                <p className="icon-picker-group-title">{group}</p>
                {renderGrid(icons)}
              </div>
            ))
          )}
        </div>

        <button type="button" className="button button--secondary sheet-submit" onClick={handleClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
