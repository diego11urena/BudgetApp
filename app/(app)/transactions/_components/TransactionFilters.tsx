"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Extra income" },
  { value: "SAVINGS", label: "Savings" },
];

const SORT_OPTIONS = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
  { value: "amount_desc", label: "Amount: high to low" },
  { value: "amount_asc", label: "Amount: low to high" },
];

export function TransactionFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

  const [q, setQ] = useState(searchParams.get("q") ?? "");

  // Debounced so typing doesn't push a URL update (and a server round trip)
  // per keystroke. type/sort changes below go straight through since
  // they're already discrete, not free text.
  useEffect(() => {
    const params = new URLSearchParams(searchParamsString);
    if (q) params.set("q", q);
    else params.delete("q");
    const next = params.toString();
    if (next === searchParamsString) return;
    const id = setTimeout(() => {
      router.replace(next ? `${pathname}?${next}` : pathname);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParamsString);
    if (value) params.set(key, value);
    else params.delete(key);
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  }

  return (
    <div className="transaction-filters">
      <input
        type="text"
        className="transaction-filters-search"
        placeholder="Search by name or category…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search transactions"
      />
      <div className="transaction-filters-row">
        <select
          value={searchParams.get("type") ?? ""}
          onChange={(e) => updateParam("type", e.target.value)}
          aria-label="Filter by type"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={searchParams.get("sort") ?? "date_desc"}
          onChange={(e) => updateParam("sort", e.target.value)}
          aria-label="Sort transactions"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
