import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import type { WorkspaceUpdateHandler } from "../../shared/model/workspace";
import type { Account, BankAccount, Party } from "../../domain";
import type { BankingAccountsViewProps } from "../../shared/model/widget-props";
import { BankAccountCreateForm } from "../../features/bank-account-create/BankAccountCreateForm";
import { BankAccountEditForm } from "../../features/bank-account-edit/BankAccountEditForm";
import { getBankTransactionDisplayState } from "./bank-transaction-display";
import { BankTransactionListItem } from "./BankTransactionListItem";

export type BankingAccountRoute =
  | { mode: "list" }
  | { mode: "create" }
  | { mode: "workspace"; bankAccountId: string }
  | { mode: "card"; bankAccountId: string }
  | { mode: "edit"; bankAccountId: string };

export function BankingAccountsView(
  props: BankingAccountsViewProps & { route: BankingAccountRoute }
) {
  const {
    workspace,
    bankAccounts,
    accounts,
    bankTransactions,
    invoices,
    parties,
    supplierInvoices,
    onWorkspaceUpdate,
    route
  } = props;
  const bankPostingAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => account.role === "posting" && account.code.startsWith("11")
      ),
    [accounts]
  );
  const bankParties = useMemo(
    () => parties.filter((party) => party.active && party.roles.includes("bank")),
    [parties]
  );

  if (route.mode === "create") {
    return (
      <BankAccountCreateForm
        bankAccounts={bankAccounts}
        bankParties={bankParties}
        bankPostingAccounts={bankPostingAccounts}
        baseCurrency={workspace.baseCurrency}
        onWorkspaceUpdate={onWorkspaceUpdate}
        workspaceId={workspace.id}
      />
    );
  }

  if (route.mode === "workspace" || route.mode === "card" || route.mode === "edit") {
    const bankAccount =
      bankAccounts.find((candidate) => candidate.id === route.bankAccountId) ?? null;

    if (!bankAccount) {
      return <BankAccountNotFound bankAccountId={route.bankAccountId} />;
    }

    return (
      <BankAccountDetailPage
        bankAccount={bankAccount}
        bankAccounts={bankAccounts}
        bankTransactions={bankTransactions}
        bankParties={bankParties}
        bankPostingAccounts={bankPostingAccounts}
        accounts={accounts}
        invoices={invoices}
        mode={route.mode}
        onWorkspaceUpdate={onWorkspaceUpdate}
        parties={parties}
        supplierInvoices={supplierInvoices}
      />
    );
  }

  return <BankAccountListPage bankAccounts={bankAccounts} parties={parties} />;
}

function BankAccountListPage({
  bankAccounts,
  parties
}: {
  bankAccounts: BankAccount[];
  parties: Party[];
}) {
  return (
    <section className="panel panel-wide" aria-label="Bank accounts">
      <div className="panel-actions">
        <Link className="primary-button" to="/workspace/banking/accounts/new">
          Create bank account
        </Link>
      </div>

      <div className="bank-account-list">
        {bankAccounts.length === 0 ? (
          <p className="empty-state">No bank accounts yet.</p>
        ) : null}
        {bankAccounts.map((bankAccount) => {
          const bankParty = parties.find((party) => party.id === bankAccount.partyId);

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
  bankAccounts,
  bankTransactions,
  bankParties,
  bankPostingAccounts,
  accounts,
  invoices,
  mode,
  onWorkspaceUpdate,
  parties,
  supplierInvoices
}: {
  bankAccount: BankAccount;
  bankAccounts: BankAccount[];
  bankTransactions: BankingAccountsViewProps["bankTransactions"];
  bankParties: Party[];
  bankPostingAccounts: Account[];
  accounts: Account[];
  invoices: BankingAccountsViewProps["invoices"];
  mode: "workspace" | "card" | "edit";
  onWorkspaceUpdate: WorkspaceUpdateHandler;
  parties: Party[];
  supplierInvoices: BankingAccountsViewProps["supplierInvoices"];
}) {
  const bankParty = parties.find((party) => party.id === bankAccount.partyId) ?? null;
  const postingAccount =
    accounts.find((account) => account.code === bankAccount.accountCode) ?? null;
  const relatedTransactions = bankTransactions.filter(
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
    bankAccounts,
    bankAccount
  );

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
        <BankAccountEditForm
          bankAccount={bankAccount}
          bankParties={bankParties}
          bankPostingAccounts={editBankAccountOptions}
          onWorkspaceUpdate={onWorkspaceUpdate}
        />
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
                  const linkedParty = parties.find(
                    (party) => party.id === bankTransaction.partyId
                  );
                  const invoiceCandidateExists = invoices.some(
                    (invoice) =>
                      invoice.partyId === bankTransaction.partyId &&
                      invoice.status !== "paid" &&
                      invoice.status !== "cancelled" &&
                      invoice.total === bankTransaction.amount &&
                      invoice.currency === bankTransaction.currency
                  );
                  const supplierCandidateExists = supplierInvoices.some(
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
                      ? invoices.find(
                          (invoice) => invoice.id === bankTransaction.matchedDocumentId
                        )
                      : undefined;
                  const matchedSupplierInvoice =
                    bankTransaction.matchedDocumentType === "supplier_invoice" &&
                    bankTransaction.matchedDocumentId
                      ? supplierInvoices.find(
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
