import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import type { Account, BankAccount, Party } from "../../domain";
import {
  BankAccountEditableFields,
  mapBankAccountToFormState,
  type BankAccountFormState
} from "../../entities/bank-account/BankAccountFields";
import { updateBankAccount } from "../../services/bank-workflow";
import { getIbanValidationMessage } from "../../shared/lib/iban";

export function BankAccountEditForm({
  bankAccount,
  bankParties,
  bankPostingAccounts
}: {
  bankAccount: BankAccount;
  bankParties: Party[];
  bankPostingAccounts: Account[];
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const [formState, setFormState] = useState<BankAccountFormState>(() =>
    mapBankAccountToFormState(bankAccount)
  );
  const [actionState, setActionState] = useState<"idle" | "updating">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const ibanValidationMessage = getIbanValidationMessage(formState.iban);

  useEffect(() => {
    setFormState(mapBankAccountToFormState(bankAccount));
  }, [bankAccount]);

  async function handleUpdateBankAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    try {
      if (ibanValidationMessage) {
        throw new Error(ibanValidationMessage);
      }

      setActionState("updating");
      const update = await updateBankAccount({
        bankAccountId: bankAccount.id,
        name: formState.name,
        accountCode: formState.accountCode,
        iban: formState.iban,
        partyId: formState.partyId,
        active: formState.active
      });

      await router.invalidate();
      void navigate({
        to: "/workspace/banking/accounts/$bankAccountId/card",
        params: { bankAccountId: bankAccount.id }
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Bank account was not updated."
      );
    } finally {
      setActionState("idle");
    }
  }

  return (
    <form className="invoice-form" onSubmit={(event) => void handleUpdateBankAccount(event)}>
      <BankAccountEditableFields
        bankParties={bankParties}
        bankPostingAccounts={bankPostingAccounts}
        formState={formState}
        ibanValidationMessage={ibanValidationMessage}
        onFormStateChange={setFormState}
        showActive
      />
      <div className="transaction-detail-actions">
        <button
          className="primary-button"
          type="submit"
          disabled={actionState !== "idle" || Boolean(ibanValidationMessage)}
        >
          {actionState === "updating" ? "Saving" : "Save bank account"}
        </button>
        <Link
          className="secondary-button"
          to="/workspace/banking/accounts/$bankAccountId/card"
          params={{ bankAccountId: bankAccount.id }}
        >
          Cancel
        </Link>
      </div>
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </form>
  );
}
