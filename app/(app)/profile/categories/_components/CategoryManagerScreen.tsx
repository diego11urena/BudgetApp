"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
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
        <div className="category-section-header">
          <h2 style={{ marginBottom: 0 }}>Your categories</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Add category"
            onClick={() => setAdding(true)}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>

        <Link href="/profile/categories/income" className="category-income-link">
          Manage income categories →
        </Link>

        {categories.length === 0 ? (
          <p className="field-hint">No categories yet — tap the + above.</p>
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

      {adding && <CategoryFormSheet type="EXPENSE" onDone={() => setAdding(false)} />}
    </>
  );
}
