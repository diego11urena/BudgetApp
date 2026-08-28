"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CreditCard, Home, LayoutGrid, Target, type LucideIcon } from "lucide-react";
import { useSheet } from "./useSheet";

// BottomNav mounts in the app layout, on every page -- QuickAddSheet (its
// own segmented type toggle, category chips, recurring-expense toggle,
// Gmail-import cross-cycle-move confirmation, ~650 lines total) only
// actually renders once the user taps "+", so it has no business being in
// every page's initial JS bundle. next/dynamic defers its chunk to that
// first tap; no ssr:false needed since it never renders during SSR anyway
// (quickAddType starts null).
const QuickAddSheet = dynamic(() => import("./QuickAddSheet").then((mod) => mod.QuickAddSheet));

type TxType = "EXPENSE" | "INCOME" | "SAVINGS";

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Rendered either side of the center "+" — Profile isn't a tab here since
// the avatar icon on Home already opens it.
const TABS_BEFORE_FAB: Tab[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/transactions", label: "Transactions", icon: CreditCard },
];
const TABS_AFTER_FAB: Tab[] = [
  { href: "/budget", label: "Recurring Expenses", icon: LayoutGrid },
  { href: "/goals", label: "Goals", icon: Target },
];

export function BottomNav({
  expenseCategoryNames,
  savingsCategoryNames,
  incomeCategoryNames,
  cycleStartDate,
}: {
  expenseCategoryNames: string[];
  savingsCategoryNames: string[];
  incomeCategoryNames: string[];
  cycleStartDate: string;
}) {
  const pathname = usePathname();
  const [quickAddType, setQuickAddType] = useState<TxType | null>(null);
  const { sheetProps, setTrigger } = useSheet();

  function renderTab(tab: Tab) {
    const isActive = pathname.startsWith(tab.href);
    const Icon = tab.icon;
    return (
      <Link
        key={tab.href}
        href={tab.href}
        className={`bottom-nav-item ${isActive ? "is-active" : ""}`}
      >
        <Icon className="bottom-nav-icon" size={22} aria-hidden="true" />
        <span className="bottom-nav-label">{tab.label}</span>
      </Link>
    );
  }

  return (
    <>
      <nav className="bottom-nav">
        {TABS_BEFORE_FAB.map(renderTab)}
        <button
          type="button"
          className="bottom-nav-fab"
          aria-label="Add a transaction"
          onClick={(e) => {
            setTrigger(e.currentTarget);
            setQuickAddType("EXPENSE");
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
        {TABS_AFTER_FAB.map(renderTab)}
      </nav>

      {quickAddType && (
        <QuickAddSheet
          initialType={quickAddType}
          expenseCategoryNames={expenseCategoryNames}
          savingsCategoryNames={savingsCategoryNames}
          incomeCategoryNames={incomeCategoryNames}
          cycleStartDate={cycleStartDate}
          {...sheetProps}
          onClose={() => setQuickAddType(null)}
        />
      )}
    </>
  );
}
