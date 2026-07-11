"use client";

import { useMemo, useState } from "react";
import { computeNetIncomeForCycle } from "@/lib/panama-tax";
import type { IncomeFormInitial } from "./IncomeForm";

function formatUSD(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function IncomePreview({
  cycleMonth,
  initial,
}: {
  cycleMonth: number;
  initial?: IncomeFormInitial;
}) {
  const [grossMonthlyAmount, setGrossMonthlyAmount] = useState(
    initial?.grossMonthlyAmount ?? "",
  );
  const [isPanamaPayroll, setIsPanamaPayroll] = useState(initial?.isPanamaPayroll ?? true);

  const breakdown = useMemo(() => {
    const gross = Number(grossMonthlyAmount);
    if (!grossMonthlyAmount || Number.isNaN(gross) || gross <= 0) return null;
    return computeNetIncomeForCycle({ grossMonthlyAmount: gross, cycleMonth, isPanamaPayroll });
  }, [grossMonthlyAmount, cycleMonth, isPanamaPayroll]);

  return (
    <>
      <div className="field">
        <label htmlFor="grossMonthlyAmount">Gross monthly amount (USD)</label>
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
                <span>ISR (est. monthly)</span>
                <span>-{formatUSD(breakdown.isrDeduction.toNumber())}</span>
              </div>
              {breakdown.decimoGrossAmount && (
                <div className="line-item">
                  <span>
                    Décimo this cycle{breakdown.decimoIsEstimated ? " (estimated)" : ""}
                  </span>
                  <span>
                    +{formatUSD(breakdown.decimoGrossAmount.toNumber())} / -
                    {formatUSD(breakdown.decimoCssDeduction?.toNumber() ?? 0)} CSS
                  </span>
                </div>
              )}
            </>
          )}
          <div className="line-item">
            <strong>Net this cycle</strong>
            <strong>{formatUSD(breakdown.netAmount.toNumber())}</strong>
          </div>
          <div className="line-item">
            <span>Net per paycheck (quincena)</span>
            <span>{formatUSD(breakdown.biweeklyNetAmount.toNumber())}</span>
          </div>
        </div>
      )}
    </>
  );
}
