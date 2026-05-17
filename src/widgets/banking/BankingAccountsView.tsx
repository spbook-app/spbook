import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { AppDataState, ReadyWorkspaceData } from "../../shared/model/workspace";
import type { Account, BankAccount, Party } from "../../domain";
import {
  BankAccountEditableFields,
  mapBankAccountToFormState,
  type BankAccountFormState
} from "../../entities/bank-account/BankAccountFields";
import { BankAccountCreateForm } from "../../features/bank-account-create/BankAccountCreateForm";
import { updateBankAccount } from "../../services/bank-workflow";
import { getIbanValidationMessage } from "../../shared/lib/iban";
import { mapOverviewToReadyState } from "../../shared/lib/workspace-overview";
import { getBankTransactionDisplayState } from "./bank-transaction-display";
import { BankTransactionListItem } from "./BankTransactionListItem";

type ReadyAppData = ReadyWorkspaceData;
type BankingAccountRoute =
  | { mode: "list" }
  | { mode: "create" }
  | { mode: "workspace"; bankAccountId: string }
  | { mode: "card"; bankAccountId: string }
  | { mode: "edit"; bankAccountId: string };

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
      <BankAccountCreateForm
        bankParties={bankParties}
        bankPostingAccounts={bankPostingAccounts}
        data={data}
        onDataStateChange={onDataStateChange}
      />
    );
  }

  if (route.mode === "workspace" || route.mode === "card" || route.mode === "edit") {
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
    <section className="panel panel-wide" aria-label="Bank accounts">
      <div className="panel-actions">
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
              to="/workspace/banking/accounts/$bankAccountId/card"
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
  mode: "workspace" | "card" | "edit";
  onDataStateChange: (state: AppDataState) => void;
}) {
  const navigate = useNavigate();
  const bankParty = data.parties.find((party) => party.id === bankAccount.partyId) ?? null;
  const postingAccount =
    data.accounts.find((account) => account.code === bankAccount.accountCode) ?? null;
  const relatedTransactions = data.bankTransactions.filter(
    (bankTransaction) => bankTransaction.bankAccountId === bankAccount.id
  );
  const sortedRelatedTransactions = [...relatedTransactions].sort((left, right) =>
    right.bookingDate.localeCompare(left.bookingDate)
  );
  const unmatchedTransactionCount = relatedTransactions.filter(
    (bankTransaction) => bankTransaction.status === "unmatched"
  ).length;
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
    <section className="panel panel-wide" aria-label={bankAccount.name}>
      {mode === "card" ? (
        <div className="entity-page-actions">
          <Link
            className="secondary-button"
            to="/workspace/banking/accounts/$bankAccountId/edit"
            params={{ bankAccountId: bankAccount.id }}
          >
            Edit bank account
          </Link>
        </div>
      ) : null}

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
              to="/workspace/banking/accounts/$bankAccountId/card"
              params={{ bankAccountId: bankAccount.id }}
            >
              Cancel
            </Link>
          </div>
        </form>
      ) : mode === "card" ? (
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
            <dd>
              {bankParty ? (
                <Link
                  to="/workspace/counterparties/$partyId"
                  params={{ partyId: bankParty.id }}
                >
                  {bankParty.name}
                </Link>
              ) : (
                "-"
              )}
            </dd>
          </div>
        </dl>
      ) : (
        <>
          <dl className="entity-summary-strip">
            <div>
              <dt>IBAN</dt>
              <dd>
                <Link
                  to="/workspace/banking/accounts/$bankAccountId/card"
                  params={{ bankAccountId: bankAccount.id }}
                >
                  {bankAccount.iban ?? "-"}
                </Link>
                <span className="status-pill">{bankAccount.active ? "active" : "inactive"}</span>
              </dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>{bankAccount.currency}</dd>
            </div>
            <div>
              <dt>Transactions</dt>
              <dd>{relatedTransactions.length}</dd>
            </div>
            <div>
              <dt>Needs action</dt>
              <dd>{unmatchedTransactionCount}</dd>
            </div>
          </dl>

          <section className="entity-workspace-section" aria-labelledby="bank-account-transactions-title">
            <div className="entity-section-header">
              <div>
                <h3 id="bank-account-transactions-title">Transactions</h3>
                <p>Bank movements filtered to this account.</p>
              </div>
              <Link
                className="secondary-button"
                to="/workspace/banking/transactions"
                search={{ bankAccountId: bankAccount.id }}
              >
                Open transaction list
              </Link>
            </div>
            {relatedTransactions.length === 0 ? (
              <p className="empty-state">No bank transactions for this account yet.</p>
            ) : null}
            {sortedRelatedTransactions.length > 0 ? (
              <div className="bank-account-transaction-list">
                {sortedRelatedTransactions.map((bankTransaction) => {
                  const linkedParty = data.parties.find(
                    (party) => party.id === bankTransaction.partyId
                  );
                  const invoiceCandidateExists = data.invoices.some(
                    (invoice) =>
                      invoice.partyId === bankTransaction.partyId &&
                      invoice.status !== "paid" &&
                      invoice.status !== "cancelled" &&
                      invoice.total === bankTransaction.amount &&
                      invoice.currency === bankTransaction.currency
                  );
                  const supplierCandidateExists = data.supplierInvoices.some(
                    (supplierInvoice) =>
                      supplierInvoice.partyId === bankTransaction.partyId &&
                      (supplierInvoice.status === "received" ||
                        supplierInvoice.status === "approved") &&
                      supplierInvoice.total === bankTransaction.amount.replace(/^-/, "") &&
                      supplierInvoice.currency === bankTransaction.currency
                  );
                  const displayState = getBankTransactionDisplayState(
                    bankTransaction,
                    linkedParty,
                    invoiceCandidateExists,
                    supplierCandidateExists
                  );
                  const matchedInvoice =
                    bankTransaction.matchedDocumentType === "invoice" &&
                    bankTransaction.matchedDocumentId
                      ? data.invoices.find(
                          (invoice) => invoice.id === bankTransaction.matchedDocumentId
                        )
                      : undefined;
                  const matchedSupplierInvoice =
                    bankTransaction.matchedDocumentType === "supplier_invoice" &&
                    bankTransaction.matchedDocumentId
                      ? data.supplierInvoices.find(
                          (supplierInvoice) =>
                            supplierInvoice.id === bankTransaction.matchedDocumentId
                        )
                      : undefined;

                  return (
                    <Link
                      className="transaction-pick"
                      key={bankTransaction.id}
                      to="/workspace/banking/transactions/$bankTransactionId"
                      params={{ bankTransactionId: bankTransaction.id }}
                    >
                      <BankTransactionListItem
                        bankTransaction={bankTransaction}
                        bankAccount={bankAccount}
                        linkedParty={linkedParty}
                        matchedInvoice={matchedInvoice}
                        matchedSupplierInvoice={matchedSupplierInvoice}
                        displayState={displayState}
                        isActive={false}
                      />
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </section>

        </>
      )}

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </section>
  );
}

function BankAccountNotFound({ bankAccountId }: { bankAccountId: string }) {
  return (
    <section className="panel" aria-labelledby="bank-account-not-found-title">
      <div className="panel-header">
        <div>
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

  if (mode === "card") {
    return { mode: "card", bankAccountId };
  }

  return { mode: "workspace", bankAccountId };
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
