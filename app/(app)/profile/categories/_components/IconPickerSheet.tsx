"use client";

import { useEffect, useState } from "react";
import { Sheet } from "../../../_components/Sheet";
import { EmptyState } from "../../../_components/EmptyState";
import { ICON_LIBRARY, searchIcons, type IconEntry } from "@/lib/category-icon-library";
import { useLocale, useT } from "../../../../_components/LocaleProvider";

/**
 * A single flat grid of the curated ~24 icons -- small enough that no
 * grouping/sectioning is needed to keep it scannable. Search (by name or
 * keyword, e.g. "car" surfaces Car/Fuel, "dog" surfaces Dog) narrows the
 * same grid rather than switching views.
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
  const t = useT();
  const locale = useLocale();

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  const trimmed = query.trim();
  const icons = trimmed ? searchIcons(trimmed) : ICON_LIBRARY;

  function renderGrid(icons: IconEntry[]) {
    return (
      <div className="icon-picker-grid">
        {icons.map((entry) => {
          const label = locale === "es" ? entry.labelEs : entry.label;
          return (
            <button
              key={entry.name}
              type="button"
              className="icon-picker-item"
              onClick={() => onPick(entry.name)}
              aria-label={label}
              title={label}
            >
              <entry.icon size={20} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <Sheet
      visible={visible}
      title={t.profile.categories.iconPicker.title}
      titleStyle={{ textAlign: "center", marginBottom: "0.75rem" }}
      onClose={handleClose}
      returnFocusTo={null}
      className="icon-picker-sheet"
    >
      <input
        type="text"
        className="transaction-filters-search"
        placeholder={t.profile.categories.iconPicker.searchPlaceholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={t.profile.categories.iconPicker.searchAria}
        autoFocus
        style={{ marginBottom: "0.75rem" }}
      />

      <div className="icon-picker-scroll">
        {icons.length > 0 ? (
          renderGrid(icons)
        ) : (
          <EmptyState>{t.profile.categories.iconPicker.noMatch(trimmed)}</EmptyState>
        )}
      </div>

      <button type="button" className="button button--secondary sheet-submit" onClick={handleClose}>
        {t.profile.categories.iconPicker.cancel}
      </button>
    </Sheet>
  );
}
