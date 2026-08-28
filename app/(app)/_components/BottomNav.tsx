"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Clock, CreditCard, Home, LayoutGrid, type LucideIcon } from "lucide-react";
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
// a persistent avatar link (see ProfileHeaderLink) opens it from every
// page's own header instead. Plan (Bills + Goals merged) and History each
// used to be their own tab, until Plan absorbed Goals and History was
// promoted from a Profile sub-page -- see the Balboa fix list's batch 11
// for why: two low-frequency screens (checked once or twice a month) were
// costing two of only five nav slots, and History (the one place to see
// quincena-over-quincena progress) used to be buried four taps deep.
const TABS_BEFORE_FAB: Tab[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/transactions", label: "Activity", icon: CreditCard },
];
const TABS_AFTER_FAB: Tab[] = [
  { href: "/plan", label: "Plan", icon: LayoutGrid },
  { href: "/history", label: "History", icon: Clock },
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
