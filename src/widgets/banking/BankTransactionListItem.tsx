import type { BankAccount, BankTransaction, Invoice, Party, SupplierInvoice } from "../../domain";
import type { BankTransactionDisplayState } from "./bank-transaction-display";

function absoluteAmount(amount: string): string {
  return amount.startsWith("-") ? amount.slice(1) : amount;
}

function isIncoming(amount: string): boolean {
  return !amount.startsWith("-");
}

export function BankTransactionListItem({
  bankTransaction,
  bankAccount,
  linkedParty,
  matchedInvoice,
  matchedSupplierInvoice,
  displayState,
  isActive
}: {
  bankTransaction: BankTransaction;
  bankAccount: BankAccount | undefined;
  linkedParty: Party | undefined;
  matchedInvoice: Invoice | undefined;
  matchedSupplierInvoice: SupplierInvoice | undefined;
  displayState: BankTransactionDisplayState;
  isActive: boolean;
}) {
  const incoming = isIncoming(bankTransaction.amount);

  // Counterparty line: linked party > statement counterparty (not linked) > description
  let primaryLine: string;
  let notLinked = false;
  if (linkedParty) {
    primaryLine = linkedParty.name;
  } else if (bankTransaction.counterpartyName) {
    primaryLine = bankTransaction.counterpartyName;
    notLinked = true;
  } else {
    primaryLine = bankTransaction.description;
  }

  const secondaryLine =
    bankTransaction.remittanceInformation ??
    (bankTransaction.counterpartyName && linkedParty ? bankTransaction.description : undefined);

  const matchedDocumentLabel = matchedInvoice
    ? `Invoice ${matchedInvoice.number}`
    : matchedSupplierInvoice
      ? `Supplier invoice ${matchedSupplierInvoice.number}`
      : undefined;

  return (
    <div className={`transaction-item${isActive ? " transaction-item-active" : ""}`}>
      <div
        className={`transaction-item-amount${incoming ? " transaction-item-amount--incoming" : " transaction-item-amount--outgoing"}`}
      >
        <strong>
          {incoming ? "+" : "-"}
          {absoluteAmount(bankTransaction.amount)}
        </strong>
        <span>{bankTransaction.currency}</span>
      </div>

      <div className="transaction-item-counterparty">
        <span className="transaction-item-primary">
          {primaryLine}
          {notLinked ? <span className="transaction-item-tag">not linked</span> : null}
        </span>
        {secondaryLine ? (
          <small className="transaction-item-secondary">{secondaryLine}</small>
        ) : null}
        {matchedDocumentLabel ? (
          <small className="transaction-item-secondary">{matchedDocumentLabel}</small>
        ) : null}
      </div>

      <div className="transaction-item-state">
        <span
          className={`transaction-item-badge transaction-item-badge--${displayState.tone}`}
        >
          {displayState.label}
        </span>
      </div>

      <div className="transaction-item-meta">
        <span>{bankAccount?.name ?? "Unknown account"}</span>
        <small>{bankTransaction.bookingDate}</small>
        {bankTransaction.valueDate &&
        bankTransaction.valueDate !== bankTransaction.bookingDate ? (
          <small>Value: {bankTransaction.valueDate}</small>
        ) : null}
        {displayState.isImported ? null : (
          <small className="transaction-item-tag">manual</small>
        )}
      </div>
    </div>
  );
}
