import type { Account, BankAccount, Party } from "../../domain";

export type BankAccountFormState = {
  name: string;
  accountCode: string;
  iban: string;
  partyId: string;
  active: boolean;
};

export function mapBankAccountToFormState(bankAccount: BankAccount): BankAccountFormState {
  return {
    name: bankAccount.name,
    accountCode: bankAccount.accountCode,
    iban: bankAccount.iban ?? "",
    partyId: bankAccount.partyId ?? "",
    active: bankAccount.active
  };
}

export function BankAccountEditableFields({
  bankParties,
  bankPostingAccounts,
  formState,
  ibanValidationMessage,
  onFormStateChange,
  showActive = false
}: {
  bankParties: Party[];
  bankPostingAccounts: Account[];
  formState: BankAccountFormState;
  ibanValidationMessage: string | null;
  onFormStateChange: (state: BankAccountFormState) => void;
  showActive?: boolean;
}) {
  function updateFormState(update: Partial<BankAccountFormState>) {
    onFormStateChange({ ...formState, ...update });
  }

  return (
    <>
      <div className="form-row">
        <label>
          <span>Account name</span>
          <input
            value={formState.name}
            onChange={(event) => updateFormState({ name: event.target.value })}
          />
        </label>
        <label>
          <span>Posting account</span>
          <select
            value={formState.accountCode}
            onChange={(event) => updateFormState({ accountCode: event.target.value })}
          >
            {bankPostingAccounts.map((account) => (
              <option key={account.id} value={account.code}>
                {account.code} · {account.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        <span>Bank party</span>
        <select
          value={formState.partyId}
          onChange={(event) => updateFormState({ partyId: event.target.value })}
        >
          <option value="">No bank party</option>
          {bankParties.map((party) => (
            <option key={party.id} value={party.id}>
              {party.name}
              {party.iban ? ` · ${party.iban}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>IBAN</span>
        <input
          aria-invalid={ibanValidationMessage ? "true" : "false"}
          placeholder="SI56 1910 0000 0123 438"
          value={formState.iban}
          onChange={(event) => updateFormState({ iban: event.target.value })}
        />
      </label>
      {ibanValidationMessage ? <p className="field-error">{ibanValidationMessage}</p> : null}
      {showActive ? (
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={formState.active}
            onChange={(event) => updateFormState({ active: event.target.checked })}
          />
          <span>Active bank account</span>
        </label>
      ) : null}
    </>
  );
}
