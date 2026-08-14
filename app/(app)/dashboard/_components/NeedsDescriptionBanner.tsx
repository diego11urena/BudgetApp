"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  DescribeYappyImportsSheet,
  type UndescribedYappyTransaction,
} from "./DescribeYappyImportsSheet";

export function NeedsDescriptionBanner({
  transactions,
}: {
  transactions: UndescribedYappyTransaction[];
}) {
  const [open, setOpen] = useState(false);
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);

  return (
    <>
      <button
        type="button"
        className="banner banner--action"
        onClick={(e) => {
          setTriggerElement(e.currentTarget);
          setOpen(true);
        }}
      >
        <span>
          {transactions.length} Yappy transfer{transactions.length === 1 ? "" : "s"} need
          {transactions.length === 1 ? "s" : ""} a description
        </span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>

      {open && (
        <DescribeYappyImportsSheet
          initialTransactions={transactions}
          returnFocusTo={triggerElement}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
