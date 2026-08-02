"use client";

import { useMemo, useState } from "react";
import { computeNetIncomeForCycle } from "@/lib/panama-tax";
import { formatUSD } from "@/lib/format";
import type { IncomeFormInitial } from "./IncomeForm";

export function IncomePreview({ initial }: { initial?: IncomeFormInitial }) {
  const [grossAmountPerCycle, setGrossAmountPerCycle] = useState(
    initial?.grossAmountPerCycle ?? "",
  );
  const [isPanamaPayroll, setIsPanamaPayroll] = useState(initial?.isPanamaPayroll ?? true);

  const breakdown = useMemo(() => {
    const gross = Number(grossAmountPerCycle);
    if (!grossAmountPerCycle || Number.isNaN(gross) || gross <= 0) return null;
    return computeNetIncomeForCycle({ grossAmountPerCycle: gross, isPanamaPayroll });
  }, [grossAmountPerCycle, isPanamaPayroll]);

  return (
    <>
      <div className="field">
        <label htmlFor="grossAmountPerCycle">Gross amount per cycle (USD)</label>
        <input
          id="grossAmountPerCycle"
          name="grossAmountPerCycle"
          type="text"
          inputMode="decimal"
          placeholder="1000.00"
          required
          value={grossAmountPerCycle}
          onChange={(e) => setGrossAmountPerCycle(e.target.value)}
        />
        <span className="field-hint">
          Your pay for one 15-day cycle (quincena), not your full monthly salary.
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
            <span>Gross</span>
            <span>{formatUSD(breakdown.grossAmount.toNumber())}</span>
          </div>
          {isPanamaPayroll && (
            <>
              <div className="line-item">
                <span>CSS (9.75%)</span>
                <span>-{formatUSD(breakdown.cssDeduction.toNumber())}</span>
              </div>
              <div className="line-item">
                <span>Seguro Educativo (1.25%)</span>
                <span>-{formatUSD(breakdown.seguroEducativoDeduction.toNumber())}</span>
              </div>
              <div className="line-item">
                <span>ISR (est.)</span>
                <span>-{formatUSD(breakdown.isrDeduction.toNumber())}</span>
              </div>
            </>
          )}
          <div className="line-item">
            <strong>Net this cycle</strong>
            <strong>{formatUSD(breakdown.netAmount.toNumber())}</strong>
          </div>
        </div>
      )}
    </>
  );
}
