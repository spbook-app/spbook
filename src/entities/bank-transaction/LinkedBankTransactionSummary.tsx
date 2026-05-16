import type { BankTransaction } from "../../domain";
import { Link } from "@tanstack/react-router";

export function LinkedBankTransactionSummary({
  bankTransaction,
  label,
  onUndo,
  undoDisabled,
  undoLabel
}: {
  bankTransaction: BankTransaction;
  label: string;
  onUndo: () => void;
  undoDisabled: boolean;
  undoLabel: string;
}) {
  return (
    <div className="linked-entries">
      <strong>{label}</strong>
      <Link
        className="linked-entry"
        to="/workspace/banking/transactions/$bankTransactionId"
        params={{ bankTransactionId: bankTransaction.id }}
      >
        <span>
          {bankTransaction.bookingDate} · {bankTransaction.amount}{" "}
          {bankTransaction.currency}
        </span>
        <small>{bankTransaction.description}</small>
      </Link>
      <button
        className="secondary-button"
        type="button"
        disabled={undoDisabled}
        onClick={onUndo}
      >
        {undoLabel}
      </button>
    </div>
  );
}
