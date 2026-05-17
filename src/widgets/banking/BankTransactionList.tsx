import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
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
import {
  createBankTransaction,
  linkBankTransactionParty,
  matchInvoicePaymentFromBankTransaction,
  matchSupplierPaymentFromBankTransaction,
  postBankFeeFromBankTransaction,
  undoBankTransactionPosting,
  updateBankTransaction
} from "../../services/bank-workflow";
import { createParty } from "../../services/party-workflow";
import { BankStatementImport } from "../../features/bank-statement-import/BankStatementImport";

function isSameStatementCounterparty(
  partyName: string,
  partyIban: string | undefined,
  statementCounterpartyName: string | undefined,
  statementCounterpartyIban: string | undefined
) {
  const normalizedPartyIban = normalizeIbanForCompare(partyIban);
  const normalizedStatementIban = normalizeIbanForCompare(statementCounterpartyIban);

  if (normalizedPartyIban && normalizedPartyIban === normalizedStatementIban) {
    return true;
  }

  return (
    partyName.trim().toLowerCase() === statementCounterpartyName?.trim().toLowerCase()
  );
}

function normalizeIbanForCompare(iban: string | undefined) {
  return iban?.replace(/\s+/g, "").toUpperCase() ?? "";
}

function isIncomingBankTransaction(bankTransaction: BankTransaction) {
  return !bankTransaction.amount.startsWith("-");
}

function absoluteBankTransactionAmount(bankTransaction: BankTransaction) {
  return bankTransaction.amount.startsWith("-")
    ? bankTransaction.amount.slice(1)
    : bankTransaction.amount;
}

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
    accounts,
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
  const activeBankAccounts = bankAccounts.filter((bankAccount) => bankAccount.active);
  const [transactionBankAccountId, setTransactionBankAccountId] = useState(
    bankAccounts[0]?.id ?? ""
  );
  const [bookingDate, setBookingDate] = useState("2026-05-15");
  const [transactionAmount, setTransactionAmount] = useState("1000.00");
  const [description, setDescription] = useState("Bank transaction");
  const [reference, setReference] = useState("");
  const [selectedEditBankTransactionId, setSelectedEditBankTransactionId] = useState("");
  const routedBankTransactionId =
    route.mode === "detail" || route.mode === "edit" ? route.bankTransactionId : "";
  const selectedEditBankTransaction =
    bankTransactions.find(
      (bankTransaction) =>
        bankTransaction.id === (routedBankTransactionId || selectedEditBankTransactionId)
    ) ??
    null;
  const canEditSelectedBankTransaction =
    selectedEditBankTransaction?.status === "unmatched" &&
    !selectedEditBankTransaction.importSource;
  const selectedStatementCounterpartyExists = selectedEditBankTransaction
    ? parties.some((party) =>
        isSameStatementCounterparty(
          party.name,
          party.iban,
          selectedEditBankTransaction.counterpartyName,
          selectedEditBankTransaction.counterpartyIban
        )
      )
    : false;
  const selectedStatementCounterpartyCandidate = selectedEditBankTransaction
    ? parties.find((party) =>
        isSameStatementCounterparty(
          party.name,
          party.iban,
          selectedEditBankTransaction.counterpartyName,
          selectedEditBankTransaction.counterpartyIban
        )
      ) ?? null
    : null;
  const canCreateCounterpartyFromSelectedTransaction = Boolean(
    selectedEditBankTransaction?.importSource &&
      selectedEditBankTransaction.counterpartyName &&
      !selectedStatementCounterpartyExists
  );
  const suggestedInvoiceMatch =
    selectedEditBankTransaction?.status === "unmatched" &&
    selectedEditBankTransaction.partyId &&
    isIncomingBankTransaction(selectedEditBankTransaction)
      ? invoices.find(
          (invoice) =>
            invoice.partyId === selectedEditBankTransaction.partyId &&
            invoice.status !== "paid" &&
            invoice.status !== "cancelled" &&
            invoice.currency === selectedEditBankTransaction.currency &&
            invoice.total === selectedEditBankTransaction.amount
        ) ?? null
      : null;
  const suggestedSupplierInvoiceMatch =
    selectedEditBankTransaction?.status === "unmatched" &&
    selectedEditBankTransaction.partyId &&
    !isIncomingBankTransaction(selectedEditBankTransaction)
      ? supplierInvoices.find(
          (supplierInvoice) =>
            supplierInvoice.partyId === selectedEditBankTransaction.partyId &&
            supplierInvoice.status !== "paid" &&
            supplierInvoice.status !== "cancelled" &&
            supplierInvoice.currency === selectedEditBankTransaction.currency &&
            supplierInvoice.total ===
              absoluteBankTransactionAmount(selectedEditBankTransaction)
        ) ?? null
      : null;
  const [editTransactionBankAccountId, setEditTransactionBankAccountId] = useState(
    selectedEditBankTransaction?.bankAccountId ?? bankAccounts[0]?.id ?? ""
  );
  const [editBookingDate, setEditBookingDate] = useState(
    selectedEditBankTransaction?.bookingDate ?? "2026-05-15"
  );
  const [editTransactionAmount, setEditTransactionAmount] = useState(
    selectedEditBankTransaction?.amount ?? "1000.00"
  );
  const [editReference, setEditReference] = useState(
    selectedEditBankTransaction?.reference ?? ""
  );
  const [editDescription, setEditDescription] = useState(
    selectedEditBankTransaction?.description ?? ""
  );
  const [actionState, setActionState] = useState<
    | "idle"
    | "creating"
    | "updating"
    | "party-create"
    | "party-link"
    | "invoice-match"
    | "supplier-match"
    | "fee"
    | "undo"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedBankAccountId = transactionBankAccountId || bankAccounts[0]?.id || "";
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

  useEffect(() => {
    if (!selectedEditBankTransaction) return;

    setSelectedEditBankTransactionId(selectedEditBankTransaction.id);
    setEditTransactionBankAccountId(selectedEditBankTransaction.bankAccountId);
    setEditBookingDate(selectedEditBankTransaction.bookingDate);
    setEditTransactionAmount(selectedEditBankTransaction.amount);
    setEditReference(selectedEditBankTransaction.reference ?? "");
    setEditDescription(selectedEditBankTransaction.description);
  }, [selectedEditBankTransaction]);

  async function handleCreateBankTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionState("creating");
    setErrorMessage(null);

    try {
      if (!selectedBankAccountId) {
        throw new Error("Create a bank account first.");
      }

      const update = await createBankTransaction({
        workspaceId: workspace.id,
        bankAccountId: selectedBankAccountId,
        bookingDate,
        amount: transactionAmount,
        currency: workspace.baseCurrency,
        description,
        reference
      });
      const createdBankTransaction = update.bankTransactions?.at(-1);

      onWorkspaceUpdate(update);

      if (createdBankTransaction) {
        void navigate({
          to: "/workspace/banking/transactions/$bankTransactionId",
          params: { bankTransactionId: createdBankTransaction.id }
        });
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Bank transaction was not created."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleUpdateBankTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    try {
      if (!selectedEditBankTransaction) {
        throw new Error("Select a bank transaction first.");
      }

      setActionState("updating");
      const update = await updateBankTransaction({
        bankTransactionId: selectedEditBankTransaction.id,
        bankAccountId: editTransactionBankAccountId,
        bookingDate: editBookingDate,
        amount: editTransactionAmount,
        description: editDescription,
        reference: editReference
      });

      onWorkspaceUpdate(update);
      void navigate({
        to: "/workspace/banking/transactions/$bankTransactionId",
        params: { bankTransactionId: selectedEditBankTransaction.id }
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Bank transaction was not updated."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleCreateCounterpartyFromBankTransaction() {
    setErrorMessage(null);

    try {
      if (!selectedEditBankTransaction?.counterpartyName) {
        throw new Error("Selected bank transaction has no counterparty name.");
      }

      if (selectedStatementCounterpartyExists) {
        throw new Error("Counterparty already exists.");
      }

      setActionState("party-create");
      const partiesUpdate = await createParty({
        workspaceId: workspace.id,
        name: selectedEditBankTransaction.counterpartyName,
        type: "business",
        roles: [selectedEditBankTransaction.amount.startsWith("-") ? "supplier" : "customer"],
        countryCode:
          selectedEditBankTransaction.counterpartyIban?.slice(0, 2) ??
          workspace.countryCode,
        iban: selectedEditBankTransaction.counterpartyIban
      });
      const createdParty = partiesUpdate.parties?.find((party) =>
        isSameStatementCounterparty(
          party.name,
          party.iban,
          selectedEditBankTransaction.counterpartyName,
          selectedEditBankTransaction.counterpartyIban
        )
      );
      const linkedUpdate = createdParty
        ? await linkBankTransactionParty({
            bankTransactionId: selectedEditBankTransaction.id,
            partyId: createdParty.id
          })
        : null;

      onWorkspaceUpdate(linkedUpdate ? { ...partiesUpdate, ...linkedUpdate } : partiesUpdate);
      setSelectedEditBankTransactionId(selectedEditBankTransaction.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Counterparty was not created."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleLinkBankTransactionParty() {
    setErrorMessage(null);

    try {
      if (!selectedEditBankTransaction) {
        throw new Error("Select a bank transaction first.");
      }

      setActionState("party-link");
      const update = await linkBankTransactionParty({
        bankTransactionId: selectedEditBankTransaction.id,
        partyId: selectedStatementCounterpartyCandidate?.id
      });

      onWorkspaceUpdate(update);
      setSelectedEditBankTransactionId(selectedEditBankTransaction.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Counterparty was not linked."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleUnlinkBankTransactionParty() {
    setErrorMessage(null);

    try {
      if (!selectedEditBankTransaction) {
        throw new Error("Select a bank transaction first.");
      }

      setActionState("party-link");
      const update = await linkBankTransactionParty({
        bankTransactionId: selectedEditBankTransaction.id,
        partyId: undefined
      });

      onWorkspaceUpdate(update);
      setSelectedEditBankTransactionId(selectedEditBankTransaction.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Counterparty was not unlinked."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleMatchSuggestedInvoice(invoiceId: string) {
    setActionState("invoice-match");
    setErrorMessage(null);

    try {
      if (!selectedEditBankTransaction) {
        throw new Error("Select a bank transaction first.");
      }

      const update = await matchInvoicePaymentFromBankTransaction(
        invoiceId,
        selectedEditBankTransaction.id
      );

      onWorkspaceUpdate(update);
      setSelectedEditBankTransactionId(selectedEditBankTransaction.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Invoice payment was not matched."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleMatchSuggestedSupplierInvoice(supplierInvoiceId: string) {
    setActionState("supplier-match");
    setErrorMessage(null);

    try {
      if (!selectedEditBankTransaction) {
        throw new Error("Select a bank transaction first.");
      }

      const update = await matchSupplierPaymentFromBankTransaction(
        supplierInvoiceId,
        selectedEditBankTransaction.id
      );

      onWorkspaceUpdate(update);
      setSelectedEditBankTransactionId(selectedEditBankTransaction.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Supplier invoice payment was not matched."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handlePostBankFee(bankTransactionId: string) {
    setActionState("fee");
    setErrorMessage(null);

    try {
      const update = await postBankFeeFromBankTransaction(bankTransactionId);

      onWorkspaceUpdate(update);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Bank fee was not posted.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleUndoBankTransactionPosting(bankTransactionId: string) {
    setActionState("undo");
    setErrorMessage(null);

    try {
      const update = await undoBankTransactionPosting(bankTransactionId);

      onWorkspaceUpdate(update);
      setSelectedEditBankTransactionId(bankTransactionId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Posting was not undone.");
    } finally {
      setActionState("idle");
    }
  }

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

  const selectedBankAccountName = selectedEditBankTransaction
    ? bankAccounts.find(
        (bankAccount) => bankAccount.id === selectedEditBankTransaction.bankAccountId
      )?.name ?? "Unknown account"
    : "Unknown account";

  if (route.mode === "create") {
    return (
      <div className="banking-section">
        <div className="subsection-header">
          <div>
            <h3>Create bank transaction</h3>
            <p>Add a signed account movement manually.</p>
          </div>
          <Link className="secondary-button" to="/workspace/banking/transactions">
            Back to list
          </Link>
        </div>

        <form
          className="invoice-form"
          onSubmit={(event) => void handleCreateBankTransaction(event)}
        >
          <BankTransactionEditableFields
            activeBankAccounts={activeBankAccounts}
            bankAccountId={selectedBankAccountId}
            bookingDate={bookingDate}
            description={description}
            reference={reference}
            transactionAmount={transactionAmount}
            onBankAccountIdChange={setTransactionBankAccountId}
            onBookingDateChange={setBookingDate}
            onDescriptionChange={setDescription}
            onReferenceChange={setReference}
            onTransactionAmountChange={setTransactionAmount}
          />
          <button className="primary-button" type="submit" disabled={actionState !== "idle"}>
            {actionState === "creating" ? "Creating" : "Create bank transaction"}
          </button>
        </form>

        {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
      </div>
    );
  }

  if (route.mode === "detail" || route.mode === "edit") {
    if (!selectedEditBankTransaction) {
      return <BankTransactionNotFound bankTransactionId={route.bankTransactionId} />;
    }

    return (
      <div className="banking-section">
        <div className="subsection-header">
          <div>
            <h3>Bank transaction</h3>
            <p>Review statement details, link counterparties, and match postings.</p>
          </div>
          <div className="transaction-detail-actions">
            {route.mode === "edit" ? (
              <Link
                className="secondary-button"
                to="/workspace/banking/transactions/$bankTransactionId"
                params={{ bankTransactionId: selectedEditBankTransaction.id }}
              >
                Cancel
              </Link>
            ) : null}
            {route.mode === "detail" && canEditSelectedBankTransaction ? (
              <Link
                className="secondary-button"
                to="/workspace/banking/transactions/$bankTransactionId/edit"
                params={{ bankTransactionId: selectedEditBankTransaction.id }}
              >
                Edit transaction
              </Link>
            ) : null}
          </div>
        </div>

        <BankTransactionDetailPanel
          key={selectedEditBankTransaction.id}
          bankAccountId={selectedEditBankTransaction.bankAccountId}
          bankAccountName={selectedBankAccountName}
          bankTransaction={selectedEditBankTransaction}
          canCreateCounterparty={canCreateCounterpartyFromSelectedTransaction}
          isLinkingCounterparty={actionState === "party-link"}
          isCreatingCounterparty={actionState === "party-create"}
          parties={parties}
          suggestedPartyId={selectedStatementCounterpartyCandidate?.id}
          suggestedInvoice={suggestedInvoiceMatch}
          suggestedSupplierInvoice={suggestedSupplierInvoiceMatch}
          isMatchingInvoice={actionState === "invoice-match"}
          isMatchingSupplierInvoice={actionState === "supplier-match"}
          isPostingBankFee={actionState === "fee"}
          isUndoingPosting={actionState === "undo"}
          onCreateCounterparty={() => void handleCreateCounterpartyFromBankTransaction()}
          onMatchInvoice={(invoiceId) => void handleMatchSuggestedInvoice(invoiceId)}
          onMatchSupplierInvoice={(supplierInvoiceId) =>
            void handleMatchSuggestedSupplierInvoice(supplierInvoiceId)
          }
          onPostBankFee={() => void handlePostBankFee(selectedEditBankTransaction.id)}
          onLinkCounterparty={() => void handleLinkBankTransactionParty()}
          onUnlinkCounterparty={() => void handleUnlinkBankTransactionParty()}
          onUndoPosting={() =>
            void handleUndoBankTransactionPosting(selectedEditBankTransaction.id)
          }
        />

        {route.mode === "edit" ? (
          <form
            className="invoice-form edit-bank-account-form"
            onSubmit={(event) => void handleUpdateBankTransaction(event)}
          >
            <BankTransactionEditableFields
              activeBankAccounts={activeBankAccounts}
              bankAccountId={editTransactionBankAccountId}
              bookingDate={editBookingDate}
              description={editDescription}
              disabled={!canEditSelectedBankTransaction}
              reference={editReference}
              transactionAmount={editTransactionAmount}
              onBankAccountIdChange={setEditTransactionBankAccountId}
              onBookingDateChange={setEditBookingDate}
              onDescriptionChange={setEditDescription}
              onReferenceChange={setEditReference}
              onTransactionAmountChange={setEditTransactionAmount}
            />
            {selectedEditBankTransaction.importSource ? (
              <p className="field-note">
                Imported bank statement entries cannot be edited. Match, post, or ignore them
                instead.
              </p>
            ) : null}
            {selectedEditBankTransaction.status !== "unmatched" ? (
              <p className="field-note">
                Processed bank transactions cannot be edited after matching or posting.
              </p>
            ) : null}
            <div className="transaction-detail-actions">
              <button
                className="primary-button"
                type="submit"
                disabled={actionState !== "idle" || !canEditSelectedBankTransaction}
              >
                {actionState === "updating" ? "Saving" : "Save bank transaction"}
              </button>
              <Link
                className="secondary-button"
                to="/workspace/banking/transactions/$bankTransactionId"
                params={{ bankTransactionId: selectedEditBankTransaction.id }}
              >
                Cancel
              </Link>
            </div>
          </form>
        ) : null}

        {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
      </div>
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

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
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

function LinkedCounterpartyField({
  bankTransaction,
  linkedParty,
  suggestedParty,
  canCreateCounterparty,
  isLinking,
  isCreating,
  showStatement,
  onLinkCounterparty,
  onCreateCounterparty,
  onUnlinkCounterparty
}: {
  bankTransaction: BankTransaction;
  linkedParty: Party | undefined;
  suggestedParty: Party | undefined;
  canCreateCounterparty: boolean;
  isLinking: boolean;
  isCreating: boolean;
  showStatement: boolean;
  onLinkCounterparty: () => void;
  onCreateCounterparty: () => void;
  onUnlinkCounterparty: () => void;
}) {
  const canEdit =
    Boolean(bankTransaction.importSource) && bankTransaction.status === "unmatched";

  if (showStatement) {
    return (
      <div className="linked-counterparty-field">
        <span>{bankTransaction.counterpartyName}</span>
      </div>
    );
  }

  if (linkedParty) {
    return (
      <div className="linked-counterparty-field">
        <Link
          to="/workspace/counterparties/$partyId"
          params={{ partyId: linkedParty.id }}
        >
          {linkedParty.name}
        </Link>
        {canEdit ? (
          <button
            className="secondary-button"
            type="button"
            disabled={isLinking}
            onClick={onUnlinkCounterparty}
          >
            {isLinking ? "Unlinking" : "Unlink"}
          </button>
        ) : null}
      </div>
    );
  }

  if (!canEdit) return null;

  if (suggestedParty) {
    return (
      <div className="linked-counterparty-field">
        <span>{suggestedParty.name}</span>
        <span
          className="info-hint"
          title="Suggested by matching statement counterparty name or IBAN."
        >
          i
        </span>
        <button
          className="secondary-button"
          type="button"
          disabled={isLinking}
          onClick={onLinkCounterparty}
        >
          {isLinking ? "Linking" : "Link counterparty"}
        </button>
      </div>
    );
  }

  if (!canCreateCounterparty) return null;

  return (
    <div className="linked-counterparty-field">
      <button
        className="secondary-button"
        type="button"
        disabled={isCreating}
        onClick={onCreateCounterparty}
      >
        {isCreating ? "Creating" : "Create counterparty"}
      </button>
    </div>
  );
}

function BankTransactionDetailPanel({
  bankAccountId,
  bankAccountName,
  bankTransaction,
  canCreateCounterparty,
  isLinkingCounterparty,
  isCreatingCounterparty,
  parties,
  suggestedPartyId,
  suggestedInvoice,
  suggestedSupplierInvoice,
  isMatchingInvoice,
  isMatchingSupplierInvoice,
  isPostingBankFee,
  isUndoingPosting,
  onCreateCounterparty,
  onMatchInvoice,
  onMatchSupplierInvoice,
  onPostBankFee,
  onLinkCounterparty,
  onUnlinkCounterparty,
  onUndoPosting
}: {
  bankAccountId: string;
  bankAccountName: string;
  bankTransaction: BankTransaction;
  canCreateCounterparty: boolean;
  isLinkingCounterparty: boolean;
  isCreatingCounterparty: boolean;
  parties: Party[];
  suggestedPartyId?: string;
  suggestedInvoice: Invoice | null;
  suggestedSupplierInvoice: SupplierInvoice | null;
  isMatchingInvoice: boolean;
  isMatchingSupplierInvoice: boolean;
  isPostingBankFee: boolean;
  isUndoingPosting: boolean;
  onCreateCounterparty: () => void;
  onMatchInvoice: (invoiceId: string) => void;
  onMatchSupplierInvoice: (supplierInvoiceId: string) => void;
  onPostBankFee: () => void;
  onLinkCounterparty: () => void;
  onUnlinkCounterparty: () => void;
  onUndoPosting: () => void;
}) {
  const [showStatement, setShowStatement] = useState(false);
  const linkedParty = parties.find((party) => party.id === bankTransaction.partyId);
  const suggestedParty = suggestedPartyId
    ? parties.find((party) => party.id === suggestedPartyId)
    : undefined;
  const hasToggle = Boolean(bankTransaction.counterpartyName) && Boolean(linkedParty || suggestedParty);
  const textDetails = ([
    ["Counterparty IBAN", bankTransaction.counterpartyIban],
    ["Booking date", bankTransaction.bookingDate],
    ["Value date", bankTransaction.valueDate],
    ["Amount", `${bankTransaction.amount} ${bankTransaction.currency}`],
    ["Status", bankTransaction.status],
    ["Description", bankTransaction.description],
    ["Reference", bankTransaction.reference],
    ["Remittance", bankTransaction.remittanceInformation],
    ["Bank reference", bankTransaction.bankReference],
    ["Entry reference", bankTransaction.entryReference],
    ["Import source", bankTransaction.importSource],
    ["External ID", bankTransaction.externalId]
  ] as Array<[string, ReactNode]>).filter(([, value]) => value != null);

  return (
    <div className="transaction-detail-panel">
      <div className="subsection-header">
        <div>
          <h3>Selected transaction details</h3>
          <p>Bank statement data is shown as read-only text for copying.</p>
        </div>
      </div>
      <dl className="copyable-details">
        <div>
          <dt>Bank account</dt>
          <dd>
            <Link
              to="/workspace/banking/accounts/$bankAccountId"
              params={{ bankAccountId }}
            >
              {bankAccountName}
            </Link>
          </dd>
        </div>
        {bankTransaction.importSource || linkedParty ? (
          <div className={hasToggle ? "copyable-details-row--with-toggle" : undefined}>
            <dt>{showStatement ? "Counterparty" : "Linked counterparty"}</dt>
            {hasToggle ? (
              <button
                className="toggle-view-button"
                type="button"
                title={showStatement ? "Show linked counterparty" : "Show statement data"}
                onClick={() => setShowStatement((s) => !s)}
              >
                ⇄
              </button>
            ) : null}
            <dd>
              <LinkedCounterpartyField
                bankTransaction={bankTransaction}
                linkedParty={linkedParty}
                suggestedParty={suggestedParty}
                canCreateCounterparty={canCreateCounterparty}
                isLinking={isLinkingCounterparty}
                isCreating={isCreatingCounterparty}
                showStatement={showStatement}
                onLinkCounterparty={onLinkCounterparty}
                onCreateCounterparty={onCreateCounterparty}
                onUnlinkCounterparty={onUnlinkCounterparty}
              />
            </dd>
          </div>
        ) : null}
        {textDetails.map(([label, value]) => (
          <div key={label as string}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {bankTransaction.matchedDocumentId ? (
        <div className="transaction-detail-actions">
          {bankTransaction.matchedDocumentType === "invoice" ? (
            <Link
              className="secondary-button"
              to="/workspace/sales/invoices/$invoiceId"
              params={{ invoiceId: bankTransaction.matchedDocumentId }}
            >
              Open invoice
            </Link>
          ) : null}
          {bankTransaction.matchedDocumentType === "supplier_invoice" ? (
            <Link
              className="secondary-button"
              to="/workspace/purchases/supplier-invoices/$supplierInvoiceId"
              params={{ supplierInvoiceId: bankTransaction.matchedDocumentId }}
            >
              Open supplier invoice
            </Link>
          ) : null}
        </div>
      ) : null}
      {suggestedInvoice ? (
        <div className="transaction-detail-actions">
          <p className="field-note">
            Suggested invoice: {suggestedInvoice.number} · {suggestedInvoice.total}{" "}
            {suggestedInvoice.currency}
          </p>
          <button
            className="secondary-button"
            type="button"
            disabled={isMatchingInvoice}
            onClick={() => onMatchInvoice(suggestedInvoice.id)}
          >
            {isMatchingInvoice ? "Matching invoice" : "Match invoice"}
          </button>
        </div>
      ) : null}
      {suggestedSupplierInvoice ? (
        <div className="transaction-detail-actions">
          <p className="field-note">
            Suggested supplier invoice: {suggestedSupplierInvoice.number} ·{" "}
            {suggestedSupplierInvoice.total} {suggestedSupplierInvoice.currency}
          </p>
          <button
            className="secondary-button"
            type="button"
            disabled={isMatchingSupplierInvoice}
            onClick={() => onMatchSupplierInvoice(suggestedSupplierInvoice.id)}
          >
            {isMatchingSupplierInvoice
              ? "Matching supplier invoice"
              : "Match supplier invoice"}
          </button>
        </div>
      ) : null}
      <div className="transaction-detail-actions">
        {bankTransaction.status === "unmatched" && bankTransaction.amount.startsWith("-") ? (
          <button
            className="secondary-button"
            type="button"
            disabled={isPostingBankFee}
            onClick={onPostBankFee}
          >
            {isPostingBankFee ? "Posting bank fee" : "Post as bank fee"}
          </button>
        ) : null}
        {bankTransaction.status !== "unmatched" ? (
          <button
            className="secondary-button"
            type="button"
            disabled={isUndoingPosting}
            onClick={onUndoPosting}
          >
            {isUndoingPosting ? "Undoing" : "Undo posting"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function BankTransactionEditableFields({
  activeBankAccounts,
  bankAccountId,
  bookingDate,
  description,
  disabled = false,
  reference,
  transactionAmount,
  onBankAccountIdChange,
  onBookingDateChange,
  onDescriptionChange,
  onReferenceChange,
  onTransactionAmountChange
}: {
  activeBankAccounts: BankAccount[];
  bankAccountId: string;
  bookingDate: string;
  description: string;
  disabled?: boolean;
  reference: string;
  transactionAmount: string;
  onBankAccountIdChange: (value: string) => void;
  onBookingDateChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onReferenceChange: (value: string) => void;
  onTransactionAmountChange: (value: string) => void;
}) {
  return (
    <>
      <div className="form-row">
        <label>
          <span>Bank account</span>
          <select
            value={bankAccountId}
            disabled={disabled}
            onChange={(event) => onBankAccountIdChange(event.target.value)}
          >
            <option value="">Select bank account</option>
            {activeBankAccounts.map((bankAccount) => (
              <option key={bankAccount.id} value={bankAccount.id}>
                {bankAccount.name} · {bankAccount.accountCode}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Booking date</span>
          <input
            type="date"
            value={bookingDate}
            disabled={disabled}
            onChange={(event) => onBookingDateChange(event.target.value)}
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          <span>Signed amount</span>
          <input
            value={transactionAmount}
            disabled={disabled}
            onChange={(event) => onTransactionAmountChange(event.target.value)}
          />
        </label>
        <label>
          <span>Reference</span>
          <input
            value={reference}
            disabled={disabled}
            onChange={(event) => onReferenceChange(event.target.value)}
          />
        </label>
      </div>
      <label>
        <span>Description</span>
        <input
          value={description}
          disabled={disabled}
          onChange={(event) => onDescriptionChange(event.target.value)}
        />
      </label>
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
