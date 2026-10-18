"use client";

import { useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  addTransactionToRecurringAction,
  rememberInsightAction,
  updateRecurringAmountAction,
} from "../../_actions/insights";
import { addTransactionAction, deleteTransactionAction } from "../../_actions/transactions";
import {
  deleteRecurringExpenseAction,
  recordRecurringExpensePaymentAction,
  restoreRecurringExpenseAction,
} from "../../budget/recurring-actions";
import { Sheet } from "../Sheet";
import { CurrencyInput } from "../CurrencyInput";
import { useSheetVisibility } from "../useSheet";
import { useToast } from "../ToastProvider";
import { useFinishPrompt } from "./useFinishPrompt";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { useLocale, useT } from "@/app/_components/LocaleProvider";

export interface Choice {
  label: string;
  variant: "primary" | "secondary" | "ghost";
  /** Runs, then the sheet closes. Absent = just close (the "later" choice). */
  run?: () => Promise<unknown>;
}

const VARIANT_CLASS = { primary: "button", secondary: "button button--secondary", ghost: "button button--ghost" };

/**
 * The shared prompt: a bottom sheet with a title, a line of detail and a
 * stack of full-width buttons. Closing it any other way (swipe, backdrop,
 * Escape) counts as "decide later": nothing is saved.
 */
export function ChoicePrompt({ title, detail, choices }: { title: string; detail?: ReactNode; choices: Choice[] }) {
  const { visible, closeThen } = useSheetVisibility();
  const finish = useFinishPrompt();
  const [pending, setPending] = useState(false);

  async function choose(choice: Choice) {
    if (choice.run) {
      setPending(true);
      await choice.run();
    }
    closeThen(finish);
  }

  return (
    <Sheet visible={visible} title={title} onClose={() => closeThen(finish)} closeOnBackdropClick={!pending}>
      {detail && <p className="insight-prompt-detail">{detail}</p>}
      {choices.map((choice) => (
        <button
          key={choice.label}
          type="button"
          className={`${VARIANT_CLASS[choice.variant]} sheet-submit`}
          disabled={pending}
          onClick={() => choose(choice)}
        >
          {choice.label}
        </button>
      ))}
    </Sheet>
  );
}

/** Stores the answer so the insight stays gone ("*": whatever its data). */
const remember = (key: string, response: string, untilHours?: number) =>
  rememberInsightAction({ key, fingerprint: "*", response, untilHours });

/** Expected recurring charge didn't show up. */
export function MissedChargePrompt({
  insightKey,
  recurring,
}: {
  insightKey: string;
  recurring: { id: string; name: string; amount: number; dueDate: string };
}) {
  const t = useT();
  const p = t.insightPrompts;
  const locale = useLocale();
  const router = useRouter();
  const { showToast } = useToast();
  const idForm = (key: string) => {
    const fd = new FormData();
    fd.set(key, recurring.id);
    return fd;
  };

  return (
    <ChoicePrompt
      title={p.missedTitle(recurring.name)}
      detail={p.missedDetail(formatCurrency(recurring.amount), formatShortDate(new Date(recurring.dueDate), locale))}
      choices={[
        {
          label: p.markAsPaid,
          variant: "primary",
          run: async () => {
            await recordRecurringExpensePaymentAction(undefined, idForm("recurringExpenseId"));
            showToast(p.markedPaid(recurring.name));
          },
        },
        { label: p.remindTomorrow, variant: "secondary", run: () => remember(insightKey, "remind-later", 24) },
        {
          label: p.stopTracking,
          variant: "secondary",
          run: async () => {
            const result = await deleteRecurringExpenseAction(undefined, idForm("id"));
            if (result && "deleted" in result) {
              const d = result.deleted;
              showToast(p.stoppedTracking(recurring.name), {
                label: t.quickAdd.undo,
                onClick: () => {
                  const fd = new FormData();
                  fd.set("recurringExpenseId", d.recurringExpenseId);
                  fd.set("cycleId", d.cycleId);
                  fd.set("targetAmount", String(d.targetAmount));
                  restoreRecurringExpenseAction(fd).then(() => router.refresh());
                },
              });
            }
          },
        },
      ]}
    />
  );
}

/** A recurring charge came in at a new price. */
export function PriceChangePrompt({
  insightKey,
  recurring,
  charged,
}: {
  insightKey: string;
  recurring: { id: string; name: string; saved: number };
  charged: number;
}) {
  const t = useT();
  const p = t.insightPrompts;
  const { showToast } = useToast();
  return (
    <ChoicePrompt
      title={p.priceTitle(recurring.name)}
      detail={p.priceDetail(formatCurrency(charged), formatCurrency(recurring.saved))}
      choices={[
        {
          label: p.updateAmount,
          variant: "primary",
          run: async () => {
            await updateRecurringAmountAction({ recurringExpenseId: recurring.id, amount: charged.toFixed(2) });
            showToast(p.amountUpdated(recurring.name, formatCurrency(charged)));
          },
        },
        { label: p.keepOldAmount, variant: "secondary", run: () => remember(insightKey, "keep-amount") },
      ]}
    />
  );
}

/** One purchase far above usual for its category. "One-time" also leaves it out of category averages. */
export function LargePurchasePrompt({
  insightKey,
  transaction,
}: {
  insightKey: string;
  transaction: { name: string; amount: number; occurredAt: string };
}) {
  const p = useT().insightPrompts;
  const locale = useLocale();
  return (
    <ChoicePrompt
      title={p.oneTimeTitle}
      detail={p.oneTimeDetail(transaction.name, formatCurrency(transaction.amount), formatShortDate(new Date(transaction.occurredAt), locale))}
      choices={[
        { label: p.oneTime, variant: "primary", run: () => remember(insightKey, "one-time") },
        { label: p.normalForMe, variant: "secondary", run: () => remember(insightKey, "normal") },
      ]}
    />
  );
}

/** The same charge keeps coming back -- make it a recurring expense? */
export function NewRecurringPrompt({
  insightKey,
  transaction,
}: {
  insightKey: string;
  transaction: { id: string; name: string; amount: number };
}) {
  const p = useT().insightPrompts;
  const { showToast } = useToast();
  return (
    <ChoicePrompt
      title={p.recurringTitle}
      detail={p.recurringDetail(transaction.name, formatCurrency(transaction.amount))}
      choices={[
        {
          label: p.addToRecurring,
          variant: "primary",
          run: async () => {
            await addTransactionToRecurringAction(transaction.id);
            showToast(p.addedToRecurring(transaction.name));
          },
        },
        { label: p.notRecurring, variant: "secondary", run: () => remember(insightKey, "not-recurring") },
      ]}
    />
  );
}

/**
 * A category is spending more than usual. The app has no per-category
 * budget to raise (budgets come from recurring items), so the prompt offers
 * dismissing it for the cycle.
 */
export function CategoryUpPrompt({ insightKey, categoryName }: { insightKey: string; categoryName: string }) {
  const p = useT().insightPrompts;
  return (
    <ChoicePrompt
      title={p.categoryUpTitle(categoryName)}
      choices={[
        { label: p.dismissForCycle, variant: "primary", run: () => remember(insightKey, "dismissed") },
        { label: p.notNow, variant: "ghost" },
      ]}
    />
  );
}

/** Near the end of a cycle with money left: move it to a goal (native picker), logged as a savings contribution. */
export function LeftoverPrompt({ amount, goalNames }: { amount: string; goalNames: string[] }) {
  const t = useT();
  const p = t.insightPrompts;
  const router = useRouter();
  const { showToast } = useToast();
  const { visible, closeThen } = useSheetVisibility();
  const finish = useFinishPrompt();
  const [goal, setGoal] = useState(goalNames[0] ?? "");
  const [value, setValue] = useState(amount);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uid = useId();

  async function move(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData();
    fd.set("type", "SAVINGS");
    fd.set("name", goal);
    fd.set("amount", value);
    const result = await addTransactionAction(undefined, fd);
    if (result && "error" in result) {
      setPending(false);
      setError(result.error);
      return;
    }
    if (result && "transactionId" in result) {
      const id = result.transactionId;
      showToast(p.movedToGoal(formatCurrency(Number(value)), goal), {
        label: t.quickAdd.undo,
        onClick: () => {
          const del = new FormData();
          del.set("transactionId", id);
          deleteTransactionAction(undefined, del).then(() => router.refresh());
        },
      });
    }
    closeThen(finish);
  }

  return (
    <Sheet visible={visible} title={p.leftoverTitle} onClose={() => closeThen(finish)} closeOnBackdropClick={!pending}>
      <form onSubmit={move}>
        <div className="field">
          <label htmlFor={`${uid}-goal`}>{p.goalLabel}</label>
          <select id={`${uid}-goal`} value={goal} onChange={(e) => setGoal(e.target.value)}>
            {goalNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${uid}-amount`}>{p.amountLabel}</label>
          <CurrencyInput id={`${uid}-amount`} defaultValue={amount} onValueChange={setValue} />
        </div>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button sheet-submit" disabled={pending || !goal}>
          {p.moveToGoal}
        </button>
      </form>
      <button type="button" className="button button--ghost sheet-submit" disabled={pending} onClick={() => closeThen(finish)}>
        {p.notNow}
      </button>
    </Sheet>
  );
}
