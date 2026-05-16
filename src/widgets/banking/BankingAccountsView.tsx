import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { AppDataState } from "../../app/App";
import type { Account, BankAccount, Party } from "../../domain";
import { createBankAccount, updateBankAccount } from "../../services/bank-workflow";
import { getIbanValidationMessage } from "../../shared/lib/iban";
import { mapOverviewToReadyState } from "../../shared/lib/workspace-overview";

type ReadyAppData = Extract<AppDataState, { state: "ready" }>;
type BankingAccountRoute =
  | { mode: "list" }
  | { mode: "create" }
  | { mode: "detail"; bankAccountId: string }
  | { mode: "edit"; bankAccountId: string };

type BankAccountFormState = {
  name: string;
  accountCode: string;
  iban: string;
  partyId: string;
  active: boolean;
};

export function BankingAccountsView({
  data,
  onDataStateChange
}: {
  data: ReadyAppData;
  onDataStateChange: (state: AppDataState) => void;
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname
  });
  const route = getBankingAccountRoute(pathname);
  const bankPostingAccounts = useMemo(
    () =>
      data.accounts.filter(
        (account) => account.role === "posting" && account.code.startsWith("11")
      ),
    [data.accounts]
  );
  const bankParties = useMemo(
    () => data.parties.filter((party) => party.active && party.roles.includes("bank")),
    [data.parties]
  );

  if (route.mode === "create") {
    return (
      <BankAccountCreatePage
        bankParties={bankParties}
        bankPostingAccounts={bankPostingAccounts}
        data={data}
        onDataStateChange={onDataStateChange}
      />
    );
  }

  if (route.mode === "detail" || route.mode === "edit") {
    const bankAccount =
      data.bankAccounts.find((candidate) => candidate.id === route.bankAccountId) ?? null;

    if (!bankAccount) {
      return <BankAccountNotFound bankAccountId={route.bankAccountId} />;
    }

    return (
      <BankAccountDetailPage
        bankAccount={bankAccount}
        bankParties={bankParties}
        bankPostingAccounts={bankPostingAccounts}
        data={data}
        mode={route.mode}
        onDataStateChange={onDataStateChange}
      />
    );
  }

  return <BankAccountListPage data={data} />;
}

function BankAccountListPage({ data }: { data: ReadyAppData }) {
  return (
    <section className="panel panel-wide" aria-labelledby="bank-accounts-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Banking</p>
          <h2 id="bank-accounts-title">Bank accounts</h2>
        </div>
        <Link className="primary-button" to="/workspace/banking/accounts/new">
          Create bank account
        </Link>
      </div>

      <div className="bank-account-list">
        {data.bankAccounts.length === 0 ? (
          <p className="empty-state">No bank accounts yet.</p>
        ) : null}
        {data.bankAccounts.map((bankAccount) => {
          const bankParty = data.parties.find((party) => party.id === bankAccount.partyId);

          return (
            <Link
              className="bank-account-row"
              key={bankAccount.id}
              to="/workspace/banking/accounts/$bankAccountId"
              params={{ bankAccountId: bankAccount.id }}
            >
              <strong>{bankAccount.name}</strong>
              <span>
                {bankAccount.accountCode} · {bankAccount.currency}
                {bankAccount.iban ? ` · ${bankAccount.iban}` : ""}
              </span>
              {bankParty ? <small>{bankParty.name}</small> : null}
              <small>{bankAccount.active ? "active" : "inactive"}</small>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function BankAccountCreatePage({
  bankParties,
  bankPostingAccounts,
  data,
  onDataStateChange
}: {
  bankParties: Party[];
  bankPostingAccounts: Account[];
  data: ReadyAppData;
  onDataStateChange: (state: AppDataState) => void;
}) {
  const navigate = useNavigate();
  const createBankAccountOptions = getCreateBankAccountOptions(
    bankPostingAccounts,
    data.bankAccounts
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
      const overview = await createBankAccount({
        workspaceId: data.workspace.id,
        name: formState.name,
        accountCode: formState.accountCode,
        currency: data.workspace.baseCurrency,
        iban: formState.iban,
        partyId: formState.partyId
      });
      const createdBankAccount = overview.bankAccounts.at(-1);

      onDataStateChange({ ...data, ...mapOverviewToReadyState(overview) });

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
          <p className="eyebrow">Banking</p>
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

function BankAccountDetailPage({
  bankAccount,
  bankParties,
  bankPostingAccounts,
  data,
  mode,
  onDataStateChange
}: {
  bankAccount: BankAccount;
  bankParties: Party[];
  bankPostingAccounts: Account[];
  data: ReadyAppData;
  mode: "detail" | "edit";
  onDataStateChange: (state: AppDataState) => void;
}) {
  const navigate = useNavigate();
  const bankParty = data.parties.find((party) => party.id === bankAccount.partyId) ?? null;
  const postingAccount =
    data.accounts.find((account) => account.code === bankAccount.accountCode) ?? null;
  const relatedTransactions = data.bankTransactions.filter(
    (bankTransaction) => bankTransaction.bankAccountId === bankAccount.id
  );
  const editBankAccountOptions = getEditBankAccountOptions(
    bankPostingAccounts,
    data.bankAccounts,
    bankAccount
  );
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
      const overview = await updateBankAccount({
        bankAccountId: bankAccount.id,
        name: formState.name,
        accountCode: formState.accountCode,
        iban: formState.iban,
        partyId: formState.partyId,
        active: formState.active
      });

      onDataStateChange({ ...data, ...mapOverviewToReadyState(overview) });
      void navigate({
        to: "/workspace/banking/accounts/$bankAccountId",
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
    <section className="panel panel-wide" aria-labelledby="bank-account-detail-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Banking</p>
          <h2 id="bank-account-detail-title">{bankAccount.name}</h2>
        </div>
        <span className="status-pill">{bankAccount.active ? "active" : "inactive"}</span>
      </div>

      <div className="transaction-detail-actions">
        <Link className="secondary-button" to="/workspace/banking/accounts">
          Back to list
        </Link>
        {mode === "detail" ? (
          <Link
            className="secondary-button"
            to="/workspace/banking/accounts/$bankAccountId/edit"
            params={{ bankAccountId: bankAccount.id }}
          >
            Edit bank account
          </Link>
        ) : null}
      </div>

      {mode === "edit" ? (
        <form className="invoice-form" onSubmit={(event) => void handleUpdateBankAccount(event)}>
          <BankAccountEditableFields
            bankParties={bankParties}
            bankPostingAccounts={editBankAccountOptions}
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
              to="/workspace/banking/accounts/$bankAccountId"
              params={{ bankAccountId: bankAccount.id }}
            >
              Cancel
            </Link>
          </div>
        </form>
      ) : (
        <>
          <dl className="detail-list copyable-details">
            <div>
              <dt>Name</dt>
              <dd>{bankAccount.name}</dd>
            </div>
            <div>
              <dt>IBAN</dt>
              <dd>{bankAccount.iban ?? "-"}</dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>{bankAccount.currency}</dd>
            </div>
            <div>
              <dt>Posting account</dt>
              <dd>
                {bankAccount.accountCode}
                {postingAccount ? ` · ${postingAccount.name}` : ""}
              </dd>
            </div>
            <div>
              <dt>Bank counterparty</dt>
              <dd>{bankParty?.name ?? "-"}</dd>
            </div>
          </dl>

          {bankParty ? (
            <div className="transaction-detail-actions">
              <Link
                className="secondary-button"
                to="/workspace/counterparties/$partyId"
                params={{ partyId: bankParty.id }}
              >
                Open bank counterparty
              </Link>
            </div>
          ) : null}

          <div className="linked-entries">
            <strong>Bank transactions</strong>
            {relatedTransactions.length === 0 ? (
              <p className="empty-state">No bank transactions for this account yet.</p>
            ) : null}
            {relatedTransactions.map((bankTransaction) => (
              <div className="linked-entry" key={bankTransaction.id}>
                <span>{bankTransaction.bookingDate}</span>
                <small>
                  {bankTransaction.amount} {bankTransaction.currency} ·{" "}
                  {bankTransaction.description}
                </small>
              </div>
            ))}
          </div>
        </>
      )}

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </section>
  );
}

function BankAccountEditableFields({
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

function BankAccountNotFound({ bankAccountId }: { bankAccountId: string }) {
  return (
    <section className="panel" aria-labelledby="bank-account-not-found-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Banking</p>
          <h2 id="bank-account-not-found-title">Bank account not found</h2>
        </div>
        <Link className="secondary-button" to="/workspace/banking/accounts">
          Back to list
        </Link>
      </div>
      <p className="empty-state">
        Bank account "{bankAccountId}" does not exist in this workspace.
      </p>
    </section>
  );
}

function getBankingAccountRoute(pathname: string): BankingAccountRoute {
  const [, workspace, banking, accounts, bankAccountId, mode] = pathname.split("/");

  if (workspace !== "workspace" || banking !== "banking" || accounts !== "accounts") {
    return { mode: "list" };
  }

  if (!bankAccountId) {
    return { mode: "list" };
  }

  if (bankAccountId === "new") {
    return { mode: "create" };
  }

  if (mode === "edit") {
    return { mode: "edit", bankAccountId };
  }

  return { mode: "detail", bankAccountId };
}

function getCreateBankAccountOptions(bankPostingAccounts: Account[], bankAccounts: BankAccount[]) {
  const usedActiveAccountCodes = new Set(
    bankAccounts
      .filter((bankAccount) => bankAccount.active)
      .map((bankAccount) => bankAccount.accountCode)
  );

  return bankPostingAccounts.filter((account) => !usedActiveAccountCodes.has(account.code));
}

function getEditBankAccountOptions(
  bankPostingAccounts: Account[],
  bankAccounts: BankAccount[],
  selectedBankAccount: BankAccount
) {
  const usedActiveAccountCodes = new Set(
    bankAccounts
      .filter((bankAccount) => bankAccount.active)
      .map((bankAccount) => bankAccount.accountCode)
  );

  return bankPostingAccounts.filter(
    (account) =>
      !usedActiveAccountCodes.has(account.code) ||
      account.code === selectedBankAccount.accountCode
  );
}

function mapBankAccountToFormState(bankAccount: BankAccount): BankAccountFormState {
  return {
    name: bankAccount.name,
    accountCode: bankAccount.accountCode,
    iban: bankAccount.iban ?? "",
    partyId: bankAccount.partyId ?? "",
    active: bankAccount.active
  };
}
