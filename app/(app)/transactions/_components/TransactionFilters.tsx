"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { TRANSACTION_TYPE_OPTIONS } from "@/lib/transaction-type";

// "" ("any type") prepended onto the shared canonical list, for the "All"
// segment. INCOME's label is shortened to "Income" here only -- as a
// four-way filter chip row, "Extra income" was the one label long enough
// to wrap onto two lines; QuickAddSheet's own add-flow toggle (a different
// context, distinguishing a real extra-income entry from ordinary income)
// keeps the fuller wording from the shared constant.
const TYPE_OPTIONS = [{ value: "", label: "All" }, ...TRANSACTION_TYPE_OPTIONS].map((opt) =>
  opt.value === "INCOME" ? { ...opt, label: "Income" } : opt,
);

export function TransactionFilters({
  categories,
  cycles,
}: {
  /** Every category across all three types, pre-sorted by type then name — same source of truth Manage Categories uses. */
  categories: { id: string; name: string }[];
  /** Current cycle first, then closed ones newest-first -- mirrors the page's own default-to-current scoping, so "Current quincena" (value "") and clearing the param mean the same thing. */
  cycles: { id: string; label: string }[];
}) {
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
      <div className="transaction-filters-search-wrap">
        <Search size={17} className="transaction-filters-search-icon" aria-hidden="true" />
        <input
          type="text"
          className="transaction-filters-search"
          placeholder="Search name or category"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search transactions"
        />
      </div>
      {/* Type as a segmented control, same visual pattern QuickAddSheet's
          own type toggle uses -- one fewer dropdown, and it's the filter
          reached for most often. Payment method and the 4-way sort order
          are gone entirely (see the Balboa fix list's batch 11.2): payment
          method never drove any downstream decision here besides itself,
          and a fixed newest-first order is simpler than a rarely-touched
          sort control. */}
      <div className="type-toggle" role="group" aria-label="Filter by type">
        {TYPE_OPTIONS.map((opt) => {
          const isActive = (searchParams.get("type") ?? "") === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              className={`type-toggle-btn ${isActive ? "is-active" : ""}`}
              onClick={() => updateParam("type", opt.value)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <div className="transaction-filters-row">
        <select
          value={searchParams.get("cycleId") ?? ""}
          onChange={(e) => updateParam("cycleId", e.target.value)}
          aria-label="Filter by quincena"
        >
          <option value="">Current quincena</option>
          {cycles.slice(1).map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={searchParams.get("category") ?? ""}
          onChange={(e) => updateParam("category", e.target.value)}
          aria-label="Filter by category"
        >
          <option value="">Category</option>
          <option value="uncategorized">Uncategorized</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
