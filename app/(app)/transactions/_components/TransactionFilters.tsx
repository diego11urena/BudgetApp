"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PAYMENT_METHOD_OPTIONS as PAYMENT_METHOD_OPTIONS_BASE } from "@/lib/payment-method";
import { TRANSACTION_TYPE_OPTIONS } from "@/lib/transaction-type";

// "" ("any type") prepended onto the shared canonical list -- same pattern
// as PAYMENT_METHOD_OPTIONS below.
const TYPE_OPTIONS = [{ value: "", label: "Type" }, ...TRANSACTION_TYPE_OPTIONS];

// "" ("any payment method") prepended onto the shared canonical list --
// only this dropdown needs that sentinel, so it's added here rather than
// in lib/payment-method.ts.
const PAYMENT_METHOD_OPTIONS = [{ value: "", label: "Payment" }, ...PAYMENT_METHOD_OPTIONS_BASE];

const SORT_OPTIONS = [
  { value: "date_desc", label: "Newest" },
  { value: "date_asc", label: "Oldest" },
  { value: "amount_desc", label: "Highest amount" },
  { value: "amount_asc", label: "Lowest amount" },
];

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
      <input
        type="text"
        className="transaction-filters-search"
        placeholder="Search by name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search transactions"
      />
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
          value={searchParams.get("paymentMethod") ?? ""}
          onChange={(e) => updateParam("paymentMethod", e.target.value)}
          aria-label="Filter by payment method"
        >
          {PAYMENT_METHOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
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
