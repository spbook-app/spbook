import { useEffect, useState, type FormEvent } from "react";
import type { AppDataState } from "../../app/App";
import { createBankAccount, updateBankAccount } from "../../services/bank-workflow";
import { mapOverviewToReadyState } from "../../shared/lib/workspace-overview";
import { getIbanValidationMessage } from "../../shared/lib/iban";

export function BankAccountsPanel({
  data,
  onDataStateChange
}: {
  data: Extract<AppDataState, { state: "ready" }>;
  onDataStateChange: (state: AppDataState) => void;
}) {
  const bankPostingAccounts = data.accounts.filter(
    (account) => account.role === "posting" && account.code.startsWith("11")
  );
  const bankParties = data.parties.filter(
    (party) => party.active && party.roles.includes("bank")
  );
  const [accountName, setAccountName] = useState("NLB EUR");
  const [accountCode, setAccountCode] = useState(bankPostingAccounts[0]?.code ?? "");
  const [iban, setIban] = useState("");
  const [bankPartyId, setBankPartyId] = useState(bankParties[0]?.id ?? "");
  const [selectedEditBankAccountId, setSelectedEditBankAccountId] = useState(
    data.bankAccounts[0]?.id ?? ""
  );
  const selectedEditBankAccount =
    data.bankAccounts.find((bankAccount) => bankAccount.id === selectedEditBankAccountId) ??
    data.bankAccounts[0] ??
    null;
  const [editAccountName, setEditAccountName] = useState(selectedEditBankAccount?.name ?? "");
  const [editAccountCode, setEditAccountCode] = useState(
    selectedEditBankAccount?.accountCode ?? bankPostingAccounts[0]?.code ?? ""
  );
  const [editIban, setEditIban] = useState(selectedEditBankAccount?.iban ?? "");
  const [editBankPartyId, setEditBankPartyId] = useState(
    selectedEditBankAccount?.partyId ?? ""
  );
  const [editActive, setEditActive] = useState(selectedEditBankAccount?.active ?? true);
  const [actionState, setActionState] = useState<"idle" | "creating" | "updating">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const usedActiveAccountCodes = new Set(
    data.bankAccounts
      .filter((bankAccount) => bankAccount.active)
      .map((bankAccount) => bankAccount.accountCode)
  );
  const createBankAccountOptions = bankPostingAccounts.filter(
    (account) => !usedActiveAccountCodes.has(account.code)
  );
  const editBankAccountOptions = bankPostingAccounts.filter(
    (account) =>
      !usedActiveAccountCodes.has(account.code) ||
      account.code === selectedEditBankAccount?.accountCode
  );
  const ibanValidationMessage = getIbanValidationMessage(iban);
  const editIbanValidationMessage = getIbanValidationMessage(editIban);
  const canCreateBankAccount =
    actionState === "idle" && createBankAccountOptions.length > 0 && !ibanValidationMessage;

  useEffect(() => {
    if (!selectedEditBankAccount) return;

    setSelectedEditBankAccountId(selectedEditBankAccount.id);
    setEditAccountName(selectedEditBankAccount.name);
    setEditAccountCode(selectedEditBankAccount.accountCode);
    setEditIban(selectedEditBankAccount.iban ?? "");
    setEditBankPartyId(selectedEditBankAccount.partyId ?? "");
    setEditActive(selectedEditBankAccount.active);
  }, [selectedEditBankAccount]);

  useEffect(() => {
    if (
      createBankAccountOptions.length > 0 &&
      !createBankAccountOptions.some((account) => account.code === accountCode)
    ) {
      setAccountCode(createBankAccountOptions[0]!.code);
    }
  }, [accountCode, createBankAccountOptions]);

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
      const overview = await createBankAccount({
        workspaceId: data.workspace.id,
        name: accountName,
        accountCode,
        currency: data.workspace.baseCurrency,
        iban,
        partyId: bankPartyId
      });

      onDataStateChange({ ...data, ...mapOverviewToReadyState(overview) });
      setSelectedEditBankAccountId(overview.bankAccounts.at(-1)?.id ?? "");
      setIban("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Bank account was not created."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleUpdateBankAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    try {
      if (!selectedEditBankAccount) {
        throw new Error("Select a bank account first.");
      }

      if (editIbanValidationMessage) {
        throw new Error(editIbanValidationMessage);
      }

      setActionState("updating");
      const overview = await updateBankAccount({
        bankAccountId: selectedEditBankAccount.id,
        name: editAccountName,
        accountCode: editAccountCode,
        iban: editIban,
        partyId: editBankPartyId,
        active: editActive
      });

      onDataStateChange({ ...data, ...mapOverviewToReadyState(overview) });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Bank account was not updated."
      );
    } finally {
      setActionState("idle");
    }
  }

  return (
    <div className="banking-section">
      <div className="subsection-header">
        <div>
          <h3>Bank accounts</h3>
          <p>Each active bank account uses a dedicated posting account.</p>
        </div>
      </div>

      <form className="invoice-form" onSubmit={(event) => void handleCreateBankAccount(event)}>
        <div className="form-row">
          <label>
            <span>Account name</span>
            <input value={accountName} onChange={(event) => setAccountName(event.target.value)} />
          </label>
          <label>
            <span>Account code</span>
            <select value={accountCode} onChange={(event) => setAccountCode(event.target.value)}>
              {createBankAccountOptions.map((account) => (
                <option key={account.id} value={account.code}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          <span>Bank party</span>
          <select value={bankPartyId} onChange={(event) => setBankPartyId(event.target.value)}>
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
            value={iban}
            onChange={(event) => setIban(event.target.value)}
          />
        </label>
        {ibanValidationMessage ? (
          <p className="field-error">{ibanValidationMessage}</p>
        ) : null}
        {createBankAccountOptions.length === 0 ? (
          <p className="field-note">No unused bank posting accounts are available.</p>
        ) : null}
        <button
          className="primary-button"
          type="submit"
          disabled={!canCreateBankAccount}
        >
          {actionState === "creating" ? "Creating" : "Create bank account"}
        </button>
      </form>

      <div className="bank-account-list">
        {data.bankAccounts.length === 0 ? (
          <p className="empty-state">No bank accounts yet.</p>
        ) : null}
        {data.bankAccounts.map((bankAccount) => (
          <button
            className={`bank-account-row ${
              selectedEditBankAccount?.id === bankAccount.id ? "bank-account-row-active" : ""
            }`}
            key={bankAccount.id}
            type="button"
            onClick={() => setSelectedEditBankAccountId(bankAccount.id)}
          >
            <strong>{bankAccount.name}</strong>
            <span>
              {bankAccount.accountCode} · {bankAccount.currency}
              {bankAccount.iban ? ` · ${bankAccount.iban}` : ""}
            </span>
            {bankAccount.partyId ? (
              <small>
                {data.parties.find((party) => party.id === bankAccount.partyId)?.name ??
                  "Unknown bank party"}
              </small>
            ) : null}
            <small>{bankAccount.active ? "active" : "inactive"}</small>
          </button>
        ))}
      </div>

      {selectedEditBankAccount ? (
        <form
          className="invoice-form edit-bank-account-form"
          onSubmit={(event) => void handleUpdateBankAccount(event)}
        >
          <div className="form-row">
            <label>
              <span>Edit name</span>
              <input
                value={editAccountName}
                onChange={(event) => setEditAccountName(event.target.value)}
              />
            </label>
            <label>
              <span>Edit posting account</span>
              <select
                value={editAccountCode}
                onChange={(event) => setEditAccountCode(event.target.value)}
              >
                {editBankAccountOptions.map((account) => (
                  <option key={account.id} value={account.code}>
                    {account.code} · {account.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            <span>Edit bank party</span>
            <select
              value={editBankPartyId}
              onChange={(event) => setEditBankPartyId(event.target.value)}
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
            <span>Edit IBAN</span>
            <input
              aria-invalid={editIbanValidationMessage ? "true" : "false"}
              placeholder="SI56 1910 0000 0123 438"
              value={editIban}
              onChange={(event) => setEditIban(event.target.value)}
            />
          </label>
          {editIbanValidationMessage ? (
            <p className="field-error">{editIbanValidationMessage}</p>
          ) : null}
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={editActive}
              onChange={(event) => setEditActive(event.target.checked)}
            />
            <span>Active bank account</span>
          </label>
          <button
            className="secondary-button"
            type="submit"
            disabled={actionState !== "idle" || Boolean(editIbanValidationMessage)}
          >
            {actionState === "updating" ? "Saving" : "Save bank account"}
          </button>
        </form>
      ) : null}

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </div>
  );
}
