"use client";

import { useState } from "react";
import { IncomeCategoryRow } from "./IncomeCategoryRow";
import { EmptyState } from "../../../../_components/EmptyState";
import type { CategoryWithUsage } from "../../_components/types";

/** Deliberately simpler than the Expense screen — flat list, search, Rename + Merge only. No icon picker, color, delete, add-category, or duplicate cleanup. */
export function IncomeCategoryManagerScreen({ categories }: { categories: CategoryWithUsage[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = categories.filter((c) => c.name.toLowerCase().includes(q));

  return (
    <>
      <input
        type="text"
        className="transaction-filters-search"
        placeholder="Search categories…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search categories"
        style={{ marginBottom: "1rem" }}
      />

      <div className="dashboard-section">
        <h2>Income categories</h2>
        {categories.length === 0 ? (
          <EmptyState>No categories yet.</EmptyState>
        ) : filtered.length === 0 ? (
          <EmptyState>No categories match &quot;{query}&quot;.</EmptyState>
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
