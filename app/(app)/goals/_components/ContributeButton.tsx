"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { addTransactionAction, deleteTransactionAction } from "../../_actions/transactions";
import { formatCurrency } from "@/lib/format";
import { useToast } from "../../_components/ToastProvider";
import { Sheet } from "../../_components/Sheet";
import { CurrencyInput } from "../../_components/CurrencyInput";
import { useSheet } from "../../_components/useSheet";
import { useT } from "@/app/_components/LocaleProvider";

export function ContributeButton({ categoryName }: { categoryName: string }) {
  const t = useT();
  const { open, triggerProps, sheetProps, close } = useSheet();

  return (
    <>
      <button type="button" className="button" {...triggerProps}>
        {t.goals.contribute}
      </button>

      {open && <ContributeSheet categoryName={categoryName} {...sheetProps} onClose={close} />}
    </>
  );
}

/**
 * A deliberately minimal sheet — just this goal's name (fixed, not
 * editable/selectable) and an amount — instead of the generic QuickAddSheet
 * this used to open (type tabs + category chips), since a contribution's
 * type and category are never in question: it's always a SAVINGS
 * transaction under this exact goal's name. Same underlying action
 * (addTransactionAction) and toast/Undo behavior as every other entry
 * point, just a smaller UI around it.
 */
function ContributeSheet({
  categoryName,
  returnFocusTo,
  onClose,
}: {
  categoryName: string;
  returnFocusTo: HTMLElement | null;
  onClose: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const { showToast } = useToast();
  const [visible, setVisible] = useState(false);
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uid = useId();
  const amountId = `${uid}-amount`;
  const errorId = `${uid}-error`;

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const fd = new FormData();
    fd.set("type", "SAVINGS");
    fd.set("name", categoryName);
    fd.set("amount", amount);
    const result = await addTransactionAction(undefined, fd);

    if (result && "error" in result) {
      setPending(false);
      setError(result.error);
      return;
    }

    if (result && "transactionId" in result) {
      const amountNumber = Number(amount);
      const newTransactionId = result.transactionId;
      showToast(t.goals.logged(formatCurrency(amountNumber), categoryName), {
        label: t.goals.undo,
        onClick: () => {
          const delFd = new FormData();
          delFd.set("transactionId", newTransactionId);
          deleteTransactionAction(undefined, delFd).then(() => router.refresh());
        },
      });
    }

    setPending(false);
    router.refresh();
    handleClose();
  }

  return (
    <Sheet visible={visible} title={t.goals.contributingTo(categoryName)} onClose={handleClose} returnFocusTo={returnFocusTo}>
      <form onSubmit={handleSubmit}>
        <div className="field sheet-amount-field">
          <label htmlFor={amountId}>{t.goals.amountLabel}</label>
          <CurrencyInput
            id={amountId}
            defaultValue={amount}
            onValueChange={setAmount}
            autoFocus
            className={`sheet-amount-input ${error ? "is-invalid" : ""}`}
            invalid={!!error}
            describedBy={error ? errorId : undefined}
          />
        </div>

        {error && (
          <p id={errorId} className="error-text" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="button sheet-submit" disabled={pending}>
          {pending ? t.goals.logging : t.goals.contribute}
        </button>
      </form>
    </Sheet>
  );
}
