import type { BankAccount } from "../../domain";

export function BankTransactionEditableFields({
  activeBankAccounts,
  bankAccountId,
  bookingDate,
  description,
  disabled = false,
  reference,
  transactionAmount,
  onBankAccountIdChange,
  onBookingDateChange,
  onDescriptionChange,
  onReferenceChange,
  onTransactionAmountChange
}: {
  activeBankAccounts: BankAccount[];
  bankAccountId: string;
  bookingDate: string;
  description: string;
  disabled?: boolean;
  reference: string;
  transactionAmount: string;
  onBankAccountIdChange: (value: string) => void;
  onBookingDateChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onReferenceChange: (value: string) => void;
  onTransactionAmountChange: (value: string) => void;
}) {
  return (
    <>
      <div className="form-row">
        <label>
          <span>Bank account</span>
          <select
            value={bankAccountId}
            disabled={disabled}
            onChange={(event) => onBankAccountIdChange(event.target.value)}
          >
            <option value="">Select bank account</option>
            {activeBankAccounts.map((bankAccount) => (
              <option key={bankAccount.id} value={bankAccount.id}>
                {bankAccount.name} · {bankAccount.accountCode}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Booking date</span>
          <input
            type="date"
            value={bookingDate}
            disabled={disabled}
            onChange={(event) => onBookingDateChange(event.target.value)}
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          <span>Signed amount</span>
          <input
            value={transactionAmount}
            disabled={disabled}
            onChange={(event) => onTransactionAmountChange(event.target.value)}
          />
        </label>
        <label>
          <span>Reference</span>
          <input
            value={reference}
            disabled={disabled}
            onChange={(event) => onReferenceChange(event.target.value)}
          />
        </label>
      </div>
      <label>
        <span>Description</span>
        <input
          value={description}
          disabled={disabled}
          onChange={(event) => onDescriptionChange(event.target.value)}
        />
      </label>
    </>
  );
}
