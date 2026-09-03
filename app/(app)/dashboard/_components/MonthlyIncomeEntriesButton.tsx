"use client";

import { MonthlyIncomeEntriesSheet, type MonthlyIncomeEntryData } from "./MonthlyIncomeEntriesSheet";
import { useSheet } from "../../_components/useSheet";
import { useT } from "@/app/_components/LocaleProvider";

/**
 * MONTHLY-budget accounts' "Edit" pill -- Header.tsx's alternate target to
 * EditPayInfoButton for a QUINCENAL account. Same trigger position/label,
 * different sheet: a cycle's own list of logged paychecks
 * (MonthlyIncomeEntriesSheet) instead of a single amount/date form, since
 * a MONTHLY cycle can hold more than one entry.
 */
export function MonthlyIncomeEntriesButton({
  entries,
  className = "home-header-edit-link",
}: {
  entries: MonthlyIncomeEntryData[];
  /** Defaults to the plain inline-text-link treatment (History's own closed-cycle usage) -- Home's own trigger passes "home-edit-pill" instead, mirroring EditPayInfoButton's own default. */
  className?: string;
}) {
  const t = useT().dashboard;
  const { open, triggerProps, sheetProps, close } = useSheet();

  return (
    <>
      <button type="button" className={className} {...triggerProps}>
        {t.monthlyIncomeEntries.button}
      </button>

      {open && <MonthlyIncomeEntriesSheet entries={entries} onDone={close} {...sheetProps} />}
    </>
  );
}
