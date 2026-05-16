import type { BankTransaction } from "../../domain";

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
      <div className="linked-entry">
        <span>
          {bankTransaction.bookingDate} · {bankTransaction.amount}{" "}
          {bankTransaction.currency}
        </span>
        <small>{bankTransaction.description}</small>
      </div>
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
