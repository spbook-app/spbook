import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { Account, BankAccount, Party } from "../../domain";
import {
  BankAccountEditableFields,
  type BankAccountFormState
} from "../../entities/bank-account/BankAccountFields";
import { createBankAccount } from "../../services/bank-workflow";
import type { WorkspaceUpdateHandler } from "../../shared/model/workspace";
import { getIbanValidationMessage } from "../../shared/lib/iban";

function getCreateBankAccountOptions(bankPostingAccounts: Account[], bankAccounts: BankAccount[]) {
  const usedActiveAccountCodes = new Set(
    bankAccounts
      .filter((bankAccount) => bankAccount.active)
      .map((bankAccount) => bankAccount.accountCode)
  );

  return bankPostingAccounts.filter((account) => !usedActiveAccountCodes.has(account.code));
}

export function BankAccountCreateForm({
  bankParties,
  bankAccounts,
  bankPostingAccounts,
  baseCurrency,
  onWorkspaceUpdate,
  workspaceId
}: {
  bankParties: Party[];
  bankAccounts: BankAccount[];
  bankPostingAccounts: Account[];
  baseCurrency: string;
  onWorkspaceUpdate: WorkspaceUpdateHandler;
  workspaceId: string;
}) {
  const navigate = useNavigate();
  const createBankAccountOptions = getCreateBankAccountOptions(
    bankPostingAccounts,
    bankAccounts
  );
  const [formState, setFormState] = useState<BankAccountFormState>({
    name: "NLB EUR",
    accountCode: createBankAccountOptions[0]?.code ?? "",
    iban: "",
    partyId: bankParties[0]?.id ?? "",
    active: true
  });
  const [actionState, setActionState] = useState<"idle" | "creating">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const ibanValidationMessage = getIbanValidationMessage(formState.iban);
  const canCreateBankAccount =
    actionState === "idle" && createBankAccountOptions.length > 0 && !ibanValidationMessage;

  useEffect(() => {
    if (
      createBankAccountOptions.length > 0 &&
      !createBankAccountOptions.some((account) => account.code === formState.accountCode)
    ) {
      setFormState((currentState) => ({
        ...currentState,
        accountCode: createBankAccountOptions[0]!.code
      }));
    }
  }, [createBankAccountOptions, formState.accountCode]);

  async function handleCreateBankAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    try {
      if (createBankAccountOptions.length === 0) {
        throw new Error("No unused bank posting accounts are available.");
      }

      if (ibanValidationMessage) {
        throw new Error(ibanValidationMessage);
      }

      setActionState("creating");
      const update = await createBankAccount({
        workspaceId,
        name: formState.name,
        accountCode: formState.accountCode,
        currency: baseCurrency,
        iban: formState.iban,
        partyId: formState.partyId
      });
      const createdBankAccount = update.bankAccounts?.at(-1);

      onWorkspaceUpdate(update);

      if (createdBankAccount) {
        void navigate({
          to: "/workspace/banking/accounts/$bankAccountId",
          params: { bankAccountId: createdBankAccount.id }
        });
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Bank account was not created."
      );
    } finally {
      setActionState("idle");
    }
  }

  return (
    <section className="panel panel-wide" aria-labelledby="create-bank-account-title">
      <div className="panel-header">
        <div>
          <h2 id="create-bank-account-title">Create bank account</h2>
        </div>
        <Link className="secondary-button" to="/workspace/banking/accounts">
          Back to list
        </Link>
      </div>

      <form className="invoice-form" onSubmit={(event) => void handleCreateBankAccount(event)}>
        <BankAccountEditableFields
          bankParties={bankParties}
          bankPostingAccounts={createBankAccountOptions}
          formState={formState}
          ibanValidationMessage={ibanValidationMessage}
          onFormStateChange={setFormState}
        />
        {createBankAccountOptions.length === 0 ? (
          <p className="field-note">No unused bank posting accounts are available.</p>
        ) : null}
        <button className="primary-button" type="submit" disabled={!canCreateBankAccount}>
          {actionState === "creating" ? "Creating" : "Create bank account"}
        </button>
      </form>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </section>
  );
}
