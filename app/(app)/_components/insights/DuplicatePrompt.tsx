"use client";

import { useState } from "react";
import { deleteTransactionAction } from "../../_actions/transactions";
import { rememberInsightAction } from "../../_actions/insights";
import { Sheet } from "../Sheet";
import { ActionSheet } from "../ActionSheet";
import { useSheetVisibility } from "../useSheet";
import { useToast } from "../ToastProvider";
import { restoreDeletedTransaction } from "../restoreDeletedTransaction";
import { useFinishPrompt } from "./useFinishPrompt";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { useLocale, useT } from "@/app/_components/LocaleProvider";

export interface DuplicateCharge {
  id: string;
  name: string;
  amount: number;
  /** ISO timestamp. */
  occurredAt: string;
}

/**
 * "Is this a duplicate?" for a possible double charge, opened on the
 * Transactions screen with both rows highlighted. Yes -> pick which one
 * goes -> confirm -> deleted with Undo. No -> the pair is never flagged
 * again. Decide later -> just closes; the insight stays on Home.
 */
export function DuplicatePrompt({ insightKey, charges }: { insightKey: string; charges: [DuplicateCharge, DuplicateCharge] }) {
  const t = useT();
  const locale = useLocale();
  const { showToast } = useToast();
  const finish = useFinishPrompt();
  const [step, setStep] = useState<"ask" | "pick" | { confirm: DuplicateCharge }>("ask");
  const { visible, closeThen } = useSheetVisibility();
  const [pending, setPending] = useState(false);
  const p = t.insightPrompts;

  const [first, second] = [...charges].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const date = (c: DuplicateCharge) => formatShortDate(new Date(c.occurredAt), locale);
  const sameDay = date(first) === date(second);
  const optionLabel = (c: DuplicateCharge, n: 1 | 2) => p.chargeOption(date(c), formatCurrency(c.amount), sameDay ? n : null);

  async function notDuplicate() {
    setPending(true);
    await rememberInsightAction({ key: insightKey, fingerprint: "*", response: "not-duplicate" });
    closeThen(finish);
  }

  async function remove(charge: DuplicateCharge) {
    const fd = new FormData();
    fd.set("transactionId", charge.id);
    const result = await deleteTransactionAction(undefined, fd);
    if (result && "error" in result) {
      showToast(result.error);
    } else if (result && "deleted" in result) {
      const d = result.deleted;
      showToast(t.quickAdd.deleted(formatCurrency(d.amount), d.name), {
        label: t.quickAdd.undo,
        onClick: () => restoreDeletedTransaction(d).then(finish),
      });
    }
    finish();
  }

  if (step === "pick") {
    return (
      <ActionSheet
        key="pick"
        title={p.whichToRemove}
        options={[
          { label: optionLabel(first, 1), onSelect: () => setStep({ confirm: first }) },
          { label: optionLabel(second, 2), onSelect: () => setStep({ confirm: second }) },
        ]}
        cancelLabel={t.common.cancel}
        onCancel={finish}
      />
    );
  }
  if (typeof step === "object") {
    const c = step.confirm;
    return (
      <ActionSheet
        key="confirm"
        title={p.deleteThisCharge}
        message={`${c.name} · ${optionLabel(c, c === first ? 1 : 2)}`}
        options={[{ label: p.deleteCharge, destructive: true, onSelect: () => remove(c) }]}
        cancelLabel={t.common.cancel}
        onCancel={finish}
      />
    );
  }

  return (
    <Sheet visible={visible} title={p.isDuplicate} onClose={() => closeThen(finish)} closeOnBackdropClick={!pending}>
      <p className="insight-prompt-detail">
        <strong>{first.name}</strong> · {formatCurrency(first.amount)}
        <br />
        {sameDay ? p.chargedTwiceOn(date(first)) : p.chargedOnTwoDates(date(first), date(second))}
      </p>
      <button type="button" className="button sheet-submit" disabled={pending} onClick={() => closeThen(() => setStep("pick"))}>
        {p.yesRemoveOne}
      </button>
      <button type="button" className="button button--secondary sheet-submit" disabled={pending} onClick={notDuplicate}>
        {p.noBothReal}
      </button>
      <button type="button" className="button button--ghost sheet-submit" disabled={pending} onClick={() => closeThen(finish)}>
        {p.decideLater}
      </button>
    </Sheet>
  );
}
