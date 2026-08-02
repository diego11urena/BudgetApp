"use client";

import { useActionState, useMemo, useState } from "react";
import { computeNetIncomeForCycle } from "@/lib/panama-tax";
import { formatUSD } from "@/lib/format";
import { updateIncomeAction, type IncomeSettingsFormState } from "../actions";

const initialState: IncomeSettingsFormState = undefined;

export interface IncomeSettingsInitial {
  name: string;
  grossMonthlyAmount: string;
  isPanamaPayroll: boolean;
}

export function IncomeSettingsForm({ initial }: { initial: IncomeSettingsInitial }) {
  const [state, formAction, pending] = useActionState(updateIncomeAction, initialState);
  const [grossMonthlyAmount, setGrossMonthlyAmount] = useState(initial.grossMonthlyAmount);
  const [isPanamaPayroll, setIsPanamaPayroll] = useState(initial.isPanamaPayroll);

  const breakdown = useMemo(() => {
    const gross = Number(grossMonthlyAmount);
    if (!grossMonthlyAmount || Number.isNaN(gross) || gross <= 0) return null;
    return computeNetIncomeForCycle({ grossMonthlyAmount: gross, isPanamaPayroll });
  }, [grossMonthlyAmount, isPanamaPayroll]);

  return (
    <form action={formAction}>
      <div className="field">
        <label htmlFor="income-name">Income name</label>
        <input
          id="income-name"
          name="name"
          type="text"
          defaultValue={initial.name}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="income-gross">Gross monthly salary (USD)</label>
        <input
          id="income-gross"
          name="grossMonthlyAmount"
          type="text"
          inputMode="decimal"
          required
          value={grossMonthlyAmount}
          onChange={(e) => setGrossMonthlyAmount(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="income-panama">
          <input
            id="income-panama"
            name="isPanamaPayroll"
            type="checkbox"
            checked={isPanamaPayroll}
            onChange={(e) => setIsPanamaPayroll(e.target.checked)}
            style={{ marginRight: "0.5rem" }}
          />
          Subject to Panama payroll deductions (CSS, Seguro Educativo, ISR)
        </label>
      </div>

      {breakdown && (
        <div className="preview-box">
          <div className="line-item">
            <span>Net monthly salary</span>
            <span>{formatUSD(breakdown.netMonthlyAmount.toNumber())}</span>
          </div>
          <div className="line-item">
            <strong>Net per quincena</strong>
            <strong>{formatUSD(breakdown.netQuincenaAmount.toNumber())}</strong>
          </div>
        </div>
      )}

      {state?.error && <p className="error-text">{state.error}</p>}
      {state?.success && (
        <p className="field-hint" style={{ marginTop: "0.5rem" }}>
          Saved — this quincena&apos;s numbers are already updated.
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Saving..." : "Save income"}
        </button>
      </div>
    </form>
  );
}
