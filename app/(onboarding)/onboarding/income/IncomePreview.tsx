"use client";

import { useMemo, useState } from "react";
import { computeNetIncomeForCycle } from "@/lib/panama-tax";
import { formatUSD } from "@/lib/format";
import type { IncomeFormInitial } from "./IncomeForm";

export function IncomePreview({ initial }: { initial?: IncomeFormInitial }) {
  const [grossMonthlyAmount, setGrossMonthlyAmount] = useState(
    initial?.grossMonthlyAmount ?? "",
  );
  const [isPanamaPayroll, setIsPanamaPayroll] = useState(initial?.isPanamaPayroll ?? true);

  const breakdown = useMemo(() => {
    const gross = Number(grossMonthlyAmount);
    if (!grossMonthlyAmount || Number.isNaN(gross) || gross <= 0) return null;
    return computeNetIncomeForCycle({ grossMonthlyAmount: gross, isPanamaPayroll });
  }, [grossMonthlyAmount, isPanamaPayroll]);

  return (
    <>
      <div className="field">
        <label htmlFor="grossMonthlyAmount">Gross monthly salary (USD)</label>
        <input
          id="grossMonthlyAmount"
          name="grossMonthlyAmount"
          type="text"
          inputMode="decimal"
          placeholder="2000.00"
          required
          value={grossMonthlyAmount}
          onChange={(e) => setGrossMonthlyAmount(e.target.value)}
        />
        <span className="field-hint">
          Your full monthly salary — we&apos;ll split it into two quincenas for you.
        </span>
      </div>
      <div className="field">
        <label htmlFor="isPanamaPayroll">
          <input
            id="isPanamaPayroll"
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
            <span>Gross (monthly)</span>
            <span>{formatUSD(breakdown.grossMonthlyAmount.toNumber())}</span>
          </div>
          {isPanamaPayroll && (
            <>
              <div className="line-item">
                <span>CSS (9.75%)</span>
                <span>-{formatUSD(breakdown.monthlyCssDeduction.toNumber())}</span>
              </div>
              <div className="line-item">
                <span>Seguro Educativo (1.25%)</span>
                <span>-{formatUSD(breakdown.monthlySeguroEducativoDeduction.toNumber())}</span>
              </div>
              <div className="line-item">
                <span>ISR (est.)</span>
                <span>-{formatUSD(breakdown.monthlyIsrDeduction.toNumber())}</span>
              </div>
            </>
          )}
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
    </>
  );
}
