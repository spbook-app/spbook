import { useRef } from "react";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import type { BankAccount, BankTransaction, Invoice, Party, SupplierInvoice } from "../../domain";
import type { BankTransactionListProps } from "../../shared/model/widget-props";
import { BankTransactionListItem } from "./BankTransactionListItem";
import {
  bankTransactionQuickFilters,
  getBankTransactionDisplayState,
  matchesQuickFilter,
  type BankTransactionDisplayState,
  type BankTransactionQuickFilterValue
} from "./bank-transaction-display";
import { BankStatementImport } from "../../features/bank-statement-import/BankStatementImport";
import { BankTransactionCreateForm } from "../../features/bank-transaction-create/BankTransactionCreateForm";
import { BankTransactionDetailSection } from "../../features/bank-transaction-detail/BankTransactionDetailSection";

export type BankTransactionRoute =
  | { mode: "list" }
  | { mode: "create" }
  | { mode: "detail"; bankTransactionId: string }
  | { mode: "edit"; bankTransactionId: string };

type BankTransactionListRow = {
  bankTransaction: BankTransaction;
  bankAccount: BankAccount | undefined;
  linkedParty: Party | undefined;
  matchedInvoice: Invoice | undefined;
  matchedSupplierInvoice: SupplierInvoice | undefined;
  displayState: BankTransactionDisplayState;
};

const bankingTransactionsListRoute = getRouteApi("/workspace/banking/transactions");

const quickFilterLabels: Record<BankTransactionQuickFilterValue, string> = {
  needs_action: "Needs action",
  needs_counterparty: "Needs counterparty",
  linked_needs_match: "Ready to match",
  invoice_candidate: "Invoice candidates",
  supplier_invoice_candidate: "Supplier candidates",
  matched: "Matched",
  posted_bank_fee: "Bank fees",
  ignored: "Ignored",
  imported: "Imported",
  manual_unmatched: "Manual"
};

// The "All" option is undefined: it clears the processingState search param.
type QuickFilterOption = [BankTransactionQuickFilterValue | undefined, string];

const quickFilterOptions: QuickFilterOption[] = [
  [undefined, "All"],
  ...bankTransactionQuickFilters.map(
    (filter): QuickFilterOption => [filter, quickFilterLabels[filter]]
  )
];

export function BankTransactionList(
  props: BankTransactionListProps & { route: BankTransactionRoute }
) {
  const {
    workspace,
    bankTransactions,
    parties,
    invoices,
    supplierInvoices,
    bankAccounts,
    route
  } = props;
  const navigate = useNavigate();
  const { bankAccountId = "", processingState } = bankingTransactionsListRoute.useSearch();
  const importDialogRef = useRef<HTMLDialogElement>(null);
  const bankTransactionRows = bankTransactions
    .map((bankTransaction): BankTransactionListRow => {
      const bankAccount = bankAccounts.find(
        (candidate) => candidate.id === bankTransaction.bankAccountId
      );
      const linkedParty = parties.find((party) => party.id === bankTransaction.partyId);
      const isIncoming = !bankTransaction.amount.startsWith("-");
      const invoiceCandidateExists =
        isIncoming &&
        Boolean(bankTransaction.partyId) &&
        invoices.some(
          (invoice) =>
            invoice.partyId === bankTransaction.partyId &&
            invoice.status !== "paid" &&
            invoice.status !== "cancelled" &&
            invoice.total === bankTransaction.amount &&
            invoice.currency === bankTransaction.currency
        );
      const supplierCandidateExists =
        !isIncoming &&
        Boolean(bankTransaction.partyId) &&
        supplierInvoices.some(
          (supplierInvoice) =>
            supplierInvoice.partyId === bankTransaction.partyId &&
            supplierInvoice.status !== "paid" &&
            supplierInvoice.status !== "cancelled" &&
            supplierInvoice.total === bankTransaction.amount.slice(1) &&
            supplierInvoice.currency === bankTransaction.currency
        );
      const displayState = getBankTransactionDisplayState(
        bankTransaction,
        linkedParty,
        invoiceCandidateExists,
        supplierCandidateExists
      );
      const matchedInvoice =
        bankTransaction.matchedDocumentType === "invoice" && bankTransaction.matchedDocumentId
          ? invoices.find((invoice) => invoice.id === bankTransaction.matchedDocumentId)
          : undefined;
      const matchedSupplierInvoice =
        bankTransaction.matchedDocumentType === "supplier_invoice" &&
        bankTransaction.matchedDocumentId
          ? supplierInvoices.find(
              (supplierInvoice) => supplierInvoice.id === bankTransaction.matchedDocumentId
            )
          : undefined;

      return {
        bankTransaction,
        bankAccount,
        linkedParty,
        matchedInvoice,
        matchedSupplierInvoice,
        displayState
      };
    })
    .sort((left, right) => {
      const dateCompare = right.bankTransaction.bookingDate.localeCompare(
        left.bankTransaction.bookingDate
      );

      return dateCompare || right.bankTransaction.id.localeCompare(left.bankTransaction.id);
    });
  const bankAccountFilteredRows = bankAccountId
    ? bankTransactionRows.filter(
        (row) => row.bankTransaction.bankAccountId === bankAccountId
      )
    : bankTransactionRows;
  const filteredBankTransactionRows = processingState
    ? bankAccountFilteredRows.filter((row) =>
        matchesQuickFilter(
          row.displayState.processingState,
          row.displayState.isImported,
          processingState
        )
      )
    : bankAccountFilteredRows;
  const quickFilterCounts = new Map<BankTransactionQuickFilterValue | undefined, number>(
    quickFilterOptions.map(([value]) => [
      value,
      value
        ? bankAccountFilteredRows.filter((row) =>
            matchesQuickFilter(
              row.displayState.processingState,
              row.displayState.isImported,
              value
            )
          ).length
        : bankAccountFilteredRows.length
    ])
  );
  const activeBankAccountFilter = bankAccounts.find(
    (bankAccount) => bankAccount.id === bankAccountId
  );
  const hasActiveListFilters = Boolean(bankAccountId || processingState);

  function handleBankAccountChange(value: string) {
    void navigate({
      to: "/workspace/banking/transactions",
      search: (prev) => ({ ...prev, bankAccountId: value || undefined }),
      replace: true
    });
  }

  function handleProcessingStateChange(value: BankTransactionQuickFilterValue | undefined) {
    void navigate({
      to: "/workspace/banking/transactions",
      search: (prev) => ({ ...prev, processingState: value }),
      replace: true
    });
  }

  if (route.mode === "create") {
    return (
      <BankTransactionCreateForm
        workspace={workspace}
        bankAccounts={bankAccounts}
      />
    );
  }

  if (route.mode === "detail" || route.mode === "edit") {
    const selectedBankTransaction =
      bankTransactions.find(
        (bankTransaction) => bankTransaction.id === route.bankTransactionId
      ) ?? null;

    if (!selectedBankTransaction) {
      return <BankTransactionNotFound bankTransactionId={route.bankTransactionId} />;
    }

    return (
      <BankTransactionDetailSection
        bankTransaction={selectedBankTransaction}
        bankAccounts={bankAccounts}
        workspace={workspace}
        parties={parties}
        invoices={invoices}
        supplierInvoices={supplierInvoices}
        mode={route.mode}
      />
    );
  }

  return (
    <>
      <div className="banking-section">
        <div className="subsection-header">
          <div>
            <h3>Bank transactions</h3>
            <p>Review imported and manual account movements as a work queue.</p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              className="secondary-button"
              onClick={() => importDialogRef.current?.showModal()}
            >
              Import statement
            </button>
            <Link className="primary-button" to="/workspace/banking/transactions/new">
              Create bank transaction
            </Link>
          </div>
        </div>

        <div className="bank-account-tabs" role="tablist" aria-label="Filter by bank account">
          <button
            type="button"
            role="tab"
            aria-selected={!bankAccountId}
            className={`bank-account-tab${!bankAccountId ? " bank-account-tab--active" : ""}`}
            onClick={() => handleBankAccountChange("")}
          >
            All
          </button>
          {bankAccounts.map((bankAccount) => (
            <button
              key={bankAccount.id}
              type="button"
              role="tab"
              aria-selected={bankAccountId === bankAccount.id}
              className={`bank-account-tab${bankAccountId === bankAccount.id ? " bank-account-tab--active" : ""}`}
              onClick={() => handleBankAccountChange(bankAccount.id)}
            >
              {bankAccount.name}
            </button>
          ))}
        </div>

        <div className="transaction-list">
          <div className="transaction-list-header">
          <span className="transaction-result-count">
            Showing {filteredBankTransactionRows.length} of {bankAccountFilteredRows.length}
            {activeBankAccountFilter ? ` · ${activeBankAccountFilter.name}` : ""}
          </span>
          {hasActiveListFilters ? (
            <button
              className="secondary-button compact-button"
              type="button"
              onClick={() =>
                void navigate({
                  to: "/workspace/banking/transactions",
                  search: {},
                  replace: true
                })
              }
            >
              Clear filters
            </button>
          ) : null}
        </div>
        <div className="transaction-list-filters">
          <div className="transaction-filter-chips" role="group" aria-label="Filter by state">
            {quickFilterOptions.map(([value, label]) => (
              <button
                key={value ?? "all"}
                type="button"
                className={`transaction-filter-chip${processingState === value ? " transaction-filter-chip--active" : ""}`}
                onClick={() => handleProcessingStateChange(value)}
              >
                {label}
                <span>{quickFilterCounts.get(value) ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
        {filteredBankTransactionRows.length === 0 ? (
          <p className="empty-state">No bank transactions yet.</p>
        ) : null}
        {filteredBankTransactionRows.map((row) => {
          return (
            <Link
              className="transaction-pick"
              key={row.bankTransaction.id}
              to="/workspace/banking/transactions/$bankTransactionId"
              params={{ bankTransactionId: row.bankTransaction.id }}
            >
              <BankTransactionListItem
                bankTransaction={row.bankTransaction}
                bankAccount={row.bankAccount}
                linkedParty={row.linkedParty}
                matchedInvoice={row.matchedInvoice}
                matchedSupplierInvoice={row.matchedSupplierInvoice}
                displayState={row.displayState}
                isActive={false}
              />
            </Link>
          );
        })}
      </div>
    </div>

    <dialog ref={importDialogRef} className="import-dialog">
      <div className="import-dialog-header">
        <h3>Import bank statement</h3>
        <button
          type="button"
          className="secondary-button"
          onClick={() => importDialogRef.current?.close()}
        >
          Close
        </button>
      </div>
      <div className="import-dialog-body">
        <BankStatementImport
          bankAccounts={bankAccounts}
          workspaceId={workspace.id}
        />
      </div>
    </dialog>
  </>
  );
}

function BankTransactionNotFound({ bankTransactionId }: { bankTransactionId: string }) {
  return (
    <div className="banking-section">
      <div className="subsection-header">
        <div>
          <h3>Bank transaction not found</h3>
          <p>Transaction "{bankTransactionId}" does not exist in this workspace.</p>
        </div>
        <Link className="secondary-button" to="/workspace/banking/transactions">
          Back to list
        </Link>
      </div>
    </div>
  );
}
