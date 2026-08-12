"use client";

import { useState } from "react";
import { ManageCategories, type ManageableCategory } from "../../_components/ManageCategories";

/**
 * Client-side filtering is enough here — a user's category list is small
 * enough that a debounced server round-trip (like Transactions' search)
 * would be overkill. ManageCategories itself is unchanged; this just
 * narrows what it's given.
 */
export function CategorySearchList({ categories }: { categories: ManageableCategory[] }) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? categories.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : categories;

  return (
    <div>
      <input
        type="text"
        className="transaction-filters-search"
        placeholder="Search categories…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search categories"
        style={{ marginBottom: "0.75rem" }}
      />
      {filtered.length === 0 ? (
        <p className="field-hint">No categories match &quot;{query}&quot;.</p>
      ) : (
        <ManageCategories categories={filtered} />
      )}
    </div>
  );
}
