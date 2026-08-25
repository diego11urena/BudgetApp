"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addTransactionAction, deleteTransactionAction } from "../../_actions/transactions";
import { formatCurrency } from "@/lib/format";
import { useToast } from "../../_components/ToastProvider";
import { useModalFocus } from "../../_components/useModalFocus";

export function ContributeButton({ categoryName }: { categoryName: string }) {
  const [open, setOpen] = useState(false);
  // Captured synchronously on click, before the sheet mounts — see
  // QuickAddSheet's returnFocusTo doc comment for why this can't just be
  // auto-detected inside the sheet itself.
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);

  return (
    <>
      <button
        type="button"
        className="button button--secondary button--small"
        onClick={(e) => {
          setTriggerElement(e.currentTarget);
          setOpen(true);
        }}
      >
        Contribute
      </button>

      {open && (
        <ContributeSheet
          categoryName={categoryName}
          returnFocusTo={triggerElement}
          onClose={() => setOpen(false)}
        />
      )}
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
  const router = useRouter();
  const { showToast } = useToast();
  const [visible, setVisible] = useState(false);
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  useModalFocus(sheetRef, handleClose, returnFocusTo);

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
      showToast(`Logged ${formatCurrency(amountNumber)} for ${categoryName}`, {
        label: "Undo",
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
    <div
      className={`sheet-backdrop ${visible ? "is-visible" : ""}`}
      onClick={handleClose}
      role="presentation"
    >
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={`sheet ${visible ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Contribute to ${categoryName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <h2 style={{ textAlign: "center", marginBottom: "1rem" }}>Contributing to {categoryName}</h2>

        <form onSubmit={handleSubmit}>
          <div className="field sheet-amount-field">
            <label htmlFor="contribute-amount">Amount (USD)</label>
            <input
              id="contribute-amount"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              required
              className={`sheet-amount-input ${error ? "is-invalid" : ""}`}
              onFocus={(e) => e.target.select()}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "contribute-error" : undefined}
            />
          </div>

          {error && (
            <p id="contribute-error" className="error-text" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="button sheet-submit" disabled={pending}>
            {pending ? "Logging..." : "Contribute"}
          </button>
        </form>
      </div>
    </div>
  );
}
