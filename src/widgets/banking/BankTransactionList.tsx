import { useRef } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import type { BankAccount, BankTransaction, Invoice, Party, SupplierInvoice } from "../../domain";
import type { BankTransactionListProps } from "../../shared/model/widget-props";
import { BankTransactionListItem } from "./BankTransactionListItem";
import {
  getBankTransactionDisplayState,
  matchesQuickFilter,
  type BankTransactionDisplayState,
  type BankTransactionQuickFilter
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

const quickFilterOptions: Array<[BankTransactionQuickFilter, string]> = [
  ["", "All"],
  ["needs_action", "Needs action"],
  ["needs_counterparty", "Needs counterparty"],
  ["linked_needs_match", "Ready to match"],
  ["invoice_candidate", "Invoice candidates"],
  ["supplier_invoice_candidate", "Supplier candidates"],
  ["matched", "Matched"],
  ["posted_bank_fee", "Bank fees"],
  ["ignored", "Ignored"],
  ["imported", "Imported"],
  ["manual_unmatched", "Manual"]
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
    onWorkspaceUpdate,
    route
  } = props;
  const navigate = useNavigate();
  const routeSearch = useSearch({ strict: false }) as {
    bankAccountId?: string;
    processingState?: string;
  };
  const listFilters = getBankTransactionListFilters(routeSearch);
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
  const bankAccountFilteredRows = listFilters.bankAccountId
    ? bankTransactionRows.filter(
        (row) => row.bankTransaction.bankAccountId === listFilters.bankAccountId
      )
    : bankTransactionRows;
  const filteredBankTransactionRows = listFilters.processingState
    ? bankAccountFilteredRows.filter((row) =>
        matchesQuickFilter(
          row.displayState.processingState,
          row.displayState.isImported,
          listFilters.processingState
        )
      )
    : bankAccountFilteredRows;
  const quickFilterCounts = new Map<BankTransactionQuickFilter, number>(
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
    (bankAccount) => bankAccount.id === listFilters.bankAccountId
  );
  const hasActiveListFilters = Boolean(
    listFilters.bankAccountId || listFilters.processingState
  );

  function handleListFilterChange(filterName: "bankAccountId" | "processingState", value: string) {
    const nextFilters = { ...listFilters, [filterName]: value };
    const nextSearchParams = new URLSearchParams();

    if (nextFilters.bankAccountId) {
      nextSearchParams.set("bankAccountId", nextFilters.bankAccountId);
    }

    if (nextFilters.processingState) {
      nextSearchParams.set("processingState", nextFilters.processingState);
    }

    const nextSearch = nextSearchParams.toString();

    void navigate({
      href: `/workspace/banking/transactions${nextSearch ? `?${nextSearch}` : ""}`,
      replace: true
    });
  }

  if (route.mode === "create") {
    return (
      <BankTransactionCreateForm
        workspace={workspace}
        bankAccounts={bankAccounts}
        onWorkspaceUpdate={onWorkspaceUpdate}
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
        onWorkspaceUpdate={onWorkspaceUpdate}
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
            aria-selected={!listFilters.bankAccountId}
            className={`bank-account-tab${!listFilters.bankAccountId ? " bank-account-tab--active" : ""}`}
            onClick={() => handleListFilterChange("bankAccountId", "")}
          >
            All
          </button>
          {bankAccounts.map((bankAccount) => (
            <button
              key={bankAccount.id}
              type="button"
              role="tab"
              aria-selected={listFilters.bankAccountId === bankAccount.id}
              className={`bank-account-tab${listFilters.bankAccountId === bankAccount.id ? " bank-account-tab--active" : ""}`}
              onClick={() => handleListFilterChange("bankAccountId", bankAccount.id)}
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
                void navigate({ href: "/workspace/banking/transactions", replace: true })
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
                key={value}
                type="button"
                className={`transaction-filter-chip${listFilters.processingState === value ? " transaction-filter-chip--active" : ""}`}
                onClick={() => handleListFilterChange("processingState", value)}
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
          onWorkspaceUpdate={onWorkspaceUpdate}
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


function getBankTransactionListFilters(search: {
  bankAccountId?: string;
  processingState?: string;
}) {
  const processingState = search.processingState;
  const validProcessingStates: BankTransactionQuickFilter[] = [
    "needs_action",
    "needs_counterparty",
    "linked_needs_match",
    "invoice_candidate",
    "supplier_invoice_candidate",
    "matched",
    "posted_bank_fee",
    "ignored",
    "imported",
    "manual_unmatched"
  ];

  return {
    bankAccountId: search.bankAccountId ?? "",
    processingState: (
      validProcessingStates.includes(processingState as BankTransactionQuickFilter)
        ? processingState
        : ""
    ) as BankTransactionQuickFilter
  };
}
