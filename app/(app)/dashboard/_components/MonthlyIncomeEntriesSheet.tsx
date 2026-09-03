"use client";

import { useEffect, useId, useState } from "react";
import { Sheet } from "../../_components/Sheet";
import { CurrencyInput } from "../../_components/CurrencyInput";
import { updateCycleIncomeEntryAction, deleteCycleIncomeEntryAction } from "../actions";
import { formatCurrency } from "@/lib/format";
import { formatCycleLabel } from "@/lib/pay-date";
import { useT } from "@/app/_components/LocaleProvider";
import { useToast } from "../../_components/ToastProvider";

export interface MonthlyIncomeEntryData {
  id: string;
  netAmount: number;
  /** "YYYY-MM-DD" -- already formatted server-side (see Header.tsx/History's own callers), same convention EditPayInfoButton's currentPayDate uses. */
  receivedAt: string;
}

/**
 * MONTHLY-budget only: view/edit/delete every paycheck logged into one
 * cycle -- the "Edit" pill's alternate target once a cycle can hold more
 * than one CycleIncomeEntry (see lib/cycles.ts's logPaycheckToOpenCycle).
 * Deliberately no "add a paycheck" affordance here -- that's what the
 * Home dashboard's own "I just got paid" button (LogPaycheckSheet) is
 * for, on the current cycle; this sheet is purely correcting what's
 * already there, for both the open cycle (via Header) and a closed one
 * (via History).
 */
export function MonthlyIncomeEntriesSheet({
  entries,
  onDone,
  returnFocusTo = null,
}: {
  entries: MonthlyIncomeEntryData[];
  onDone: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const t = useT().dashboard;
  const { showToast } = useToast();
  const [visible, setVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onDone, 200);
  }

  async function handleDelete(entryId: string) {
    setDeletingId(entryId);
    const result = await deleteCycleIncomeEntryAction(entryId);
    setDeletingId(null);
    if (result?.error) {
      showToast(result.error);
    }
  }

  return (
    <Sheet
      visible={visible}
      title={t.monthlyIncomeEntries.title}
      titleStyle={{ textAlign: "center", marginBottom: "0.5rem" }}
      onClose={handleClose}
      returnFocusTo={returnFocusTo}
    >
      {entries.length === 0 ? (
        <p className="field-hint" style={{ textAlign: "center" }}>
          {t.monthlyIncomeEntries.empty}
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {entries.map((entry) =>
            editingId === entry.id ? (
              <MonthlyIncomeEntryEditRow key={entry.id} entry={entry} onDone={() => setEditingId(null)} />
            ) : (
              <li
                key={entry.id}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}
              >
                <span style={{ display: "flex", flexDirection: "column" }}>
                  <span>{formatCurrency(entry.netAmount)}</span>
                  <span className="field-hint">{entry.receivedAt}</span>
                </span>
                <span style={{ display: "flex", gap: "0.75rem" }}>
                  <button type="button" className="home-header-edit-link" onClick={() => setEditingId(entry.id)}>
                    {t.monthlyIncomeEntries.edit}
                  </button>
                  <button
                    type="button"
                    className="home-header-edit-link"
                    onClick={() => handleDelete(entry.id)}
                    disabled={deletingId === entry.id}
                  >
                    {t.monthlyIncomeEntries.delete}
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}

      <button type="button" className="button button--secondary sheet-submit" onClick={handleClose}>
        {t.monthlyIncomeEntries.close}
      </button>
    </Sheet>
  );
}

function MonthlyIncomeEntryEditRow({ entry, onDone }: { entry: MonthlyIncomeEntryData; onDone: () => void }) {
  const t = useT().dashboard;
  const [amount, setAmount] = useState(entry.netAmount.toFixed(2));
  const [payDate, setPayDate] = useState(entry.receivedAt);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uid = useId();
  const amountId = `${uid}-amount`;
  const dateId = `${uid}-date`;

  async function handleSave() {
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("entryId", entry.id);
    fd.set("netPayAmount", amount);
    fd.set("payDate", payDate);
    const result = await updateCycleIncomeEntryAction(fd);
    if (result?.error) {
      setPending(false);
      setError(result.error);
      return;
    }
    setPending(false);
    onDone();
  }

  return (
    <li style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div className="field">
        <label htmlFor={amountId}>{t.netPayLabel}</label>
        <CurrencyInput id={amountId} defaultValue={amount} onValueChange={setAmount} className="sheet-amount-input" />
      </div>
      <div className="field">
        <label htmlFor={dateId}>{t.logPaycheck.dateLabel}</label>
        <input
          id={dateId}
          type="date"
          value={payDate}
          max={formatCycleLabel()}
          onChange={(e) => setPayDate(e.target.value)}
        />
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button type="button" className="button" onClick={handleSave} disabled={pending}>
          {pending ? t.monthlyIncomeEntries.saving : t.monthlyIncomeEntries.save}
        </button>
        <button type="button" className="button button--secondary" onClick={onDone} disabled={pending}>
          {t.logPaycheck.cancel}
        </button>
      </div>
    </li>
  );
}
