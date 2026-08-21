"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { CategoryRow } from "./CategoryRow";
import { CategoryFormSheet } from "./CategoryFormSheet";
import { CategoryCleanupSection, type DuplicatePairWithUsage } from "./CategoryCleanupSection";
import type { CategoryWithUsage } from "./types";

export function CategoryManagerScreen({
  categories,
  duplicates,
}: {
  categories: CategoryWithUsage[];
  duplicates: DuplicatePairWithUsage[];
}) {
  const [query, setQuery] = useState("");
  const [unusedExpanded, setUnusedExpanded] = useState(false);
  const [adding, setAdding] = useState(false);

  const q = query.trim().toLowerCase();
  const matches = (c: CategoryWithUsage) => c.name.toLowerCase().includes(q);

  const allUnused = categories.filter((c) => c.isUnused);
  const active = categories.filter((c) => !c.isUnused && matches(c));
  const unusedMatches = allUnused.filter(matches);
  const showUnusedSection = unusedExpanded || (q !== "" && unusedMatches.length > 0);

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
        <h2>Your categories</h2>
        {categories.length === 0 ? (
          <p className="field-hint">No categories yet — tap &quot;+ Add category&quot; below.</p>
        ) : active.length === 0 ? (
          <p className="field-hint">
            {q ? `No categories match "${query}".` : "No active categories — check Unused below."}
          </p>
        ) : (
          <div className="category-row-list">
            {active.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                otherCategories={categories.filter((c) => c.id !== category.id)}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          className="button button--secondary"
          style={{ marginTop: "0.75rem" }}
          onClick={() => setAdding(true)}
        >
          + Add category
        </button>

        {allUnused.length > 0 && (
          <div className="category-unused-section">
            <button
              type="button"
              className="category-unused-toggle"
              onClick={() => setUnusedExpanded((v) => !v)}
              aria-expanded={showUnusedSection}
            >
              {showUnusedSection ? (
                <ChevronDown size={16} aria-hidden="true" />
              ) : (
                <ChevronRight size={16} aria-hidden="true" />
              )}
              Unused categories · {allUnused.length}
            </button>
            {showUnusedSection && (
              <div className="category-row-list">
                {unusedMatches.length === 0 ? (
                  <p className="field-hint">No unused categories match &quot;{query}&quot;.</p>
                ) : (
                  unusedMatches.map((category) => (
                    <CategoryRow
                      key={category.id}
                      category={category}
                      otherCategories={categories.filter((c) => c.id !== category.id)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <CategoryCleanupSection duplicates={duplicates} allCategories={categories} />

      <p className="category-income-link">
        <Link href="/profile/categories/income">Manage income categories →</Link>
      </p>

      {adding && <CategoryFormSheet onDone={() => setAdding(false)} />}
    </>
  );
}
