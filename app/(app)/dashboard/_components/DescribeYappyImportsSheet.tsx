"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useModalFocus } from "../../_components/useModalFocus";
import { describeTransactionAction } from "../../_actions/transactions";
import { formatCurrency } from "@/lib/format";

export interface UndescribedYappyTransaction {
  id: string;
  name: string;
  amount: number;
  /** Yappy is P2P — the counterparty's name alone doesn't say what the money was for, in either direction. */
  direction: "sent" | "received";
}

export function DescribeYappyImportsSheet({
  initialTransactions,
  returnFocusTo = null,
  onClose,
}: {
  initialTransactions: UndescribedYappyTransaction[];
  returnFocusTo?: HTMLElement | null;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [transactions, setTransactions] = useState(initialTransactions);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  function handleDescribed(transactionId: string) {
    setTransactions((prev) => {
      const next = prev.filter((t) => t.id !== transactionId);
      if (next.length === 0) handleClose();
      return next;
    });
  }

  // autoFocus off — same reasoning as CategorizeImportsSheet: this sheet
  // appears passively, nothing should grab the keyboard until tapped.
  useModalFocus(sheetRef, handleClose, returnFocusTo, false);

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
        aria-label="Describe Yappy transfers"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <h2 style={{ textAlign: "center", marginBottom: "0.5rem" }}>What were these for?</h2>
        <p className="field-hint" style={{ textAlign: "center", marginBottom: "1rem" }}>
          Yappy is person-to-person — the name alone doesn&apos;t say what the money was for, and
          these came through with no message attached.
        </p>

        <div className="categorize-imports-list">
          {transactions.map((transaction) => (
            <DescribeImportRow
              key={transaction.id}
              transaction={transaction}
              onDescribed={() => handleDescribed(transaction.id)}
            />
          ))}
        </div>

        <button
          type="button"
          className="button button--secondary sheet-submit"
          onClick={handleClose}
        >
          Done for now
        </button>
      </div>
    </div>
  );
}

function DescribeImportRow({
  transaction,
  onDescribed,
}: {
  transaction: UndescribedYappyTransaction;
  onDescribed: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!value.trim()) {
      setError("Tell us what it was for");
      return;
    }
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("transactionId", transaction.id);
    fd.set("description", value.trim());
    const result = await describeTransactionAction(fd);
    if ("error" in result) {
      setPending(false);
      setError(result.error);
      return;
    }
    router.refresh();
    onDescribed();
  }

  return (
    <form className="categorize-imports-row" onSubmit={handleSubmit}>
      <div className="categorize-imports-row-header">
        <span className="categorize-imports-row-name">
          {transaction.direction === "sent" ? "Sent to" : "Received from"} {transaction.name}
        </span>
        <span className="categorize-imports-row-amount">{formatCurrency(transaction.amount)}</span>
      </div>
      <div className="categorize-imports-row-input">
        <input
          type="text"
          placeholder="Rent, lunch, gift…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={200}
          autoComplete="off"
        />
      </div>
      {error && <p className="error-text">{error}</p>}
      <button type="submit" className="button button--small" disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
