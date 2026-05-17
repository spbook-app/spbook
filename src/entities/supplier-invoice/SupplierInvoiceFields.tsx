import type { Party } from "../../domain";

export function SupplierInvoiceEditableFields({
  currency,
  disabled = false,
  expenseAccountCode,
  issueDate,
  number,
  partyId,
  supplierParties,
  total,
  onExpenseAccountCodeChange,
  onIssueDateChange,
  onNumberChange,
  onPartyIdChange,
  onTotalChange
}: {
  currency: string;
  disabled?: boolean;
  expenseAccountCode: string;
  issueDate: string;
  number: string;
  partyId: string;
  supplierParties: Party[];
  total: string;
  onExpenseAccountCodeChange: (value: string) => void;
  onIssueDateChange: (value: string) => void;
  onNumberChange: (value: string) => void;
  onPartyIdChange: (value: string) => void;
  onTotalChange: (value: string) => void;
}) {
  return (
    <>
      <label>
        <span>Supplier</span>
        <select
          required
          value={partyId}
          disabled={disabled}
          onChange={(event) => onPartyIdChange(event.target.value)}
        >
          <option value="">Select supplier</option>
          {supplierParties.map((party) => (
            <option key={party.id} value={party.id}>
              {party.name}
            </option>
          ))}
        </select>
      </label>
      <div className="form-row">
        <label>
          <span>Number</span>
          <input
            required
            value={number}
            disabled={disabled}
            onChange={(event) => onNumberChange(event.target.value)}
          />
        </label>
        <label>
          <span>Issue date</span>
          <input
            required
            type="date"
            value={issueDate}
            disabled={disabled}
            onChange={(event) => onIssueDateChange(event.target.value)}
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          <span>Total</span>
          <input
            required
            inputMode="decimal"
            value={total}
            disabled={disabled}
            onChange={(event) => onTotalChange(event.target.value)}
          />
        </label>
        <label>
          <span>Expense account</span>
          <input
            value={expenseAccountCode}
            disabled={disabled}
            onChange={(event) => onExpenseAccountCodeChange(event.target.value)}
          />
        </label>
      </div>
      <label>
        <span>Currency</span>
        <input readOnly value={currency} />
      </label>
    </>
  );
}
