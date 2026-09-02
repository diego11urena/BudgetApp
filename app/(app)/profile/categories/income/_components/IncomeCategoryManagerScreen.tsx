"use client";

import { useState } from "react";
import { IncomeCategoryRow } from "./IncomeCategoryRow";
import { EmptyState } from "../../../../_components/EmptyState";
import type { CategoryWithUsage } from "../../_components/types";
import { useT } from "../../../../../_components/LocaleProvider";

/** Deliberately simpler than the Expense screen — flat list, search, Rename + Merge only. No icon picker, color, delete, add-category, or duplicate cleanup. */
export function IncomeCategoryManagerScreen({ categories }: { categories: CategoryWithUsage[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = categories.filter((c) => c.name.toLowerCase().includes(q));
  const t = useT();

  return (
    <>
      <input
        type="text"
        className="transaction-filters-search"
        placeholder={t.profile.categories.searchPlaceholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={t.profile.categories.searchAria}
        style={{ marginBottom: "1rem" }}
      />

      <div className="dashboard-section">
        <h2>{t.profile.categories.incomeCategories}</h2>
        {categories.length === 0 ? (
          <EmptyState>{t.profile.categories.noCategories}</EmptyState>
        ) : filtered.length === 0 ? (
          <EmptyState>{t.profile.categories.noMatch(query)}</EmptyState>
        ) : (
          <div className="category-row-list">
            {filtered.map((category) => (
              <IncomeCategoryRow
                key={category.id}
                category={category}
                otherCategories={categories.filter((c) => c.id !== category.id)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
