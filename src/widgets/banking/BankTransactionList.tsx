import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { BankTransaction } from "../../domain";
import type { AppDataState } from "../../app/App";
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
import { mapOverviewToReadyState } from "../../shared/lib/workspace-overview";

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

type BankTransactionRoute =
  | { mode: "list" }
  | { mode: "create" }
  | { mode: "detail"; bankTransactionId: string }
  | { mode: "edit"; bankTransactionId: string };

export function BankTransactionList({
  data,
  onDataStateChange
}: {
  data: Extract<AppDataState, { state: "ready" }>;
  onDataStateChange: (state: AppDataState) => void;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname
  });
  const searchStr = useRouterState({
    select: (state) => state.location.searchStr
  });
  const route = getBankTransactionRoute(pathname);
  const listFilters = getBankTransactionListFilters(searchStr);
  const activeBankAccounts = data.bankAccounts.filter((bankAccount) => bankAccount.active);
  const [transactionBankAccountId, setTransactionBankAccountId] = useState(
    data.bankAccounts[0]?.id ?? ""
  );
  const [bookingDate, setBookingDate] = useState("2026-05-15");
  const [transactionAmount, setTransactionAmount] = useState("1000.00");
  const [description, setDescription] = useState("Bank transaction");
  const [reference, setReference] = useState("");
  const [selectedEditBankTransactionId, setSelectedEditBankTransactionId] = useState("");
  const routedBankTransactionId =
    route.mode === "detail" || route.mode === "edit" ? route.bankTransactionId : "";
  const selectedEditBankTransaction =
    data.bankTransactions.find(
      (bankTransaction) =>
        bankTransaction.id === (routedBankTransactionId || selectedEditBankTransactionId)
    ) ??
    null;
  const canEditSelectedBankTransaction =
    selectedEditBankTransaction?.status === "unmatched" &&
    !selectedEditBankTransaction.importSource;
  const selectedStatementCounterpartyExists = selectedEditBankTransaction
    ? data.parties.some((party) =>
        isSameStatementCounterparty(
          party.name,
          party.iban,
          selectedEditBankTransaction.counterpartyName,
          selectedEditBankTransaction.counterpartyIban
        )
      )
    : false;
  const selectedStatementCounterpartyCandidate = selectedEditBankTransaction
    ? data.parties.find((party) =>
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
      ? data.invoices.find(
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
      ? data.supplierInvoices.find(
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
    selectedEditBankTransaction?.bankAccountId ?? data.bankAccounts[0]?.id ?? ""
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
  const [linkedPartyId, setLinkedPartyId] = useState(
    selectedEditBankTransaction?.partyId ?? selectedStatementCounterpartyCandidate?.id ?? ""
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
  const selectedBankAccountId = transactionBankAccountId || data.bankAccounts[0]?.id || "";
  const filteredBankTransactions = data.bankTransactions.filter((bankTransaction) => {
    if (
      listFilters.bankAccountId &&
      bankTransaction.bankAccountId !== listFilters.bankAccountId
    ) {
      return false;
    }

    if (listFilters.status && bankTransaction.status !== listFilters.status) {
      return false;
    }

    return true;
  });

  useEffect(() => {
    if (!selectedEditBankTransaction) return;

    setSelectedEditBankTransactionId(selectedEditBankTransaction.id);
    setEditTransactionBankAccountId(selectedEditBankTransaction.bankAccountId);
    setEditBookingDate(selectedEditBankTransaction.bookingDate);
    setEditTransactionAmount(selectedEditBankTransaction.amount);
    setEditReference(selectedEditBankTransaction.reference ?? "");
    setEditDescription(selectedEditBankTransaction.description);
    setLinkedPartyId(
      selectedEditBankTransaction.partyId ?? selectedStatementCounterpartyCandidate?.id ?? ""
    );
  }, [selectedEditBankTransaction, selectedStatementCounterpartyCandidate?.id]);

  async function handleCreateBankTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionState("creating");
    setErrorMessage(null);

    try {
      if (!selectedBankAccountId) {
        throw new Error("Create a bank account first.");
      }

      const overview = await createBankTransaction({
        workspaceId: data.workspace.id,
        bankAccountId: selectedBankAccountId,
        bookingDate,
        amount: transactionAmount,
        currency: data.workspace.baseCurrency,
        description,
        reference
      });
      const createdBankTransaction = overview.bankTransactions.at(-1);

      onDataStateChange({ ...data, ...mapOverviewToReadyState(overview) });

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
      const overview = await updateBankTransaction({
        bankTransactionId: selectedEditBankTransaction.id,
        bankAccountId: editTransactionBankAccountId,
        bookingDate: editBookingDate,
        amount: editTransactionAmount,
        description: editDescription,
        reference: editReference
      });

      onDataStateChange({ ...data, ...mapOverviewToReadyState(overview) });
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
      const overview = await createParty({
        workspaceId: data.workspace.id,
        name: selectedEditBankTransaction.counterpartyName,
        type: "business",
        roles: [selectedEditBankTransaction.amount.startsWith("-") ? "supplier" : "customer"],
        countryCode:
          selectedEditBankTransaction.counterpartyIban?.slice(0, 2) ??
          data.workspace.countryCode,
        iban: selectedEditBankTransaction.counterpartyIban
      });
      const createdParty = overview.parties.find((party) =>
        isSameStatementCounterparty(
          party.name,
          party.iban,
          selectedEditBankTransaction.counterpartyName,
          selectedEditBankTransaction.counterpartyIban
        )
      );
      const linkedOverview = createdParty
        ? await linkBankTransactionParty({
            bankTransactionId: selectedEditBankTransaction.id,
            partyId: createdParty.id
          })
        : overview;

      onDataStateChange({ ...data, ...mapOverviewToReadyState(linkedOverview) });
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
      const overview = await linkBankTransactionParty({
        bankTransactionId: selectedEditBankTransaction.id,
        partyId: linkedPartyId
      });

      onDataStateChange({ ...data, ...mapOverviewToReadyState(overview) });
      setSelectedEditBankTransactionId(selectedEditBankTransaction.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Counterparty was not linked."
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

      const overview = await matchInvoicePaymentFromBankTransaction(
        invoiceId,
        selectedEditBankTransaction.id
      );

      onDataStateChange({ ...data, ...mapOverviewToReadyState(overview) });
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

      const overview = await matchSupplierPaymentFromBankTransaction(
        supplierInvoiceId,
        selectedEditBankTransaction.id
      );

      onDataStateChange({ ...data, ...mapOverviewToReadyState(overview) });
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
      const overview = await postBankFeeFromBankTransaction(bankTransactionId);

      onDataStateChange({ ...data, ...mapOverviewToReadyState(overview) });
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
      const overview = await undoBankTransactionPosting(bankTransactionId);

      onDataStateChange({ ...data, ...mapOverviewToReadyState(overview) });
      setSelectedEditBankTransactionId(bankTransactionId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Posting was not undone.");
    } finally {
      setActionState("idle");
    }
  }

  function handleListFilterChange(filterName: "bankAccountId" | "status", value: string) {
    const nextSearchParams = new URLSearchParams(searchStr);

    if (value) {
      nextSearchParams.set(filterName, value);
    } else {
      nextSearchParams.delete(filterName);
    }

    const nextSearch = nextSearchParams.toString();

    void navigate({
      href: `/workspace/banking/transactions${nextSearch ? `?${nextSearch}` : ""}`,
      replace: true
    });
  }

  const selectedBankAccountName = selectedEditBankTransaction
    ? data.bankAccounts.find(
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
            <Link className="secondary-button" to="/workspace/banking/transactions">
              Back to list
            </Link>
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
          bankAccountId={selectedEditBankTransaction.bankAccountId}
          bankAccountName={selectedBankAccountName}
          bankTransaction={selectedEditBankTransaction}
          canCreateCounterparty={canCreateCounterpartyFromSelectedTransaction}
          counterpartyExists={selectedStatementCounterpartyExists}
          isLinkingCounterparty={actionState === "party-link"}
          isCreatingCounterparty={actionState === "party-create"}
          linkedPartyId={linkedPartyId}
          parties={data.parties}
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
          onLinkedPartyChange={setLinkedPartyId}
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
    <div className="banking-section">
      <div className="subsection-header">
        <div>
          <h3>Bank transactions</h3>
          <p>Add signed account movements and match them to documents.</p>
        </div>
        <Link className="primary-button" to="/workspace/banking/transactions/new">
          Create bank transaction
        </Link>
      </div>

      <div className="transaction-list">
        <div className="statement-import-row">
          <label>
            <span>Filter bank account</span>
            <select
              value={listFilters.bankAccountId}
              onChange={(event) =>
                handleListFilterChange("bankAccountId", event.target.value)
              }
            >
              <option value="">All bank accounts</option>
              {data.bankAccounts.map((bankAccount) => (
                <option key={bankAccount.id} value={bankAccount.id}>
                  {bankAccount.name} · {bankAccount.accountCode}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Filter status</span>
            <select
              value={listFilters.status}
              onChange={(event) => handleListFilterChange("status", event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="unmatched">unmatched</option>
              <option value="matched">matched</option>
              <option value="posted">posted</option>
              <option value="ignored">ignored</option>
            </select>
          </label>
        </div>
        {filteredBankTransactions.length === 0 ? (
          <p className="empty-state">No bank transactions yet.</p>
        ) : null}
        {filteredBankTransactions.map((bankTransaction) => {
          const bankAccount = data.bankAccounts.find(
            (candidate) => candidate.id === bankTransaction.bankAccountId
          );

          return (
            <Link
              className="transaction-pick"
              key={bankTransaction.id}
              to="/workspace/banking/transactions/$bankTransactionId"
              params={{ bankTransactionId: bankTransaction.id }}
            >
              <strong>
                {bankTransaction.amount} {bankTransaction.currency}
              </strong>
              <span>
                {bankTransaction.bookingDate} · {bankAccount?.name ?? "Unknown account"} ·{" "}
                {bankTransaction.status}
              </span>
              <small>{bankTransaction.description}</small>
              {bankTransaction.counterpartyName || bankTransaction.externalId ? (
                <span className="transaction-details">
                  <span>
                    Statement counterparty: {bankTransaction.counterpartyName ?? "Unknown"}
                  </span>
                  {bankTransaction.counterpartyIban ? (
                    <span>
                      Statement counterparty IBAN: {bankTransaction.counterpartyIban}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </div>
  );
}

function BankTransactionDetailPanel({
  bankAccountId,
  bankAccountName,
  bankTransaction,
  canCreateCounterparty,
  counterpartyExists,
  isLinkingCounterparty,
  isCreatingCounterparty,
  linkedPartyId,
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
  onLinkedPartyChange,
  onUndoPosting
}: {
  bankAccountId: string;
  bankAccountName: string;
  bankTransaction: BankTransaction;
  canCreateCounterparty: boolean;
  counterpartyExists: boolean;
  isLinkingCounterparty: boolean;
  isCreatingCounterparty: boolean;
  linkedPartyId: string;
  parties: Extract<AppDataState, { state: "ready" }>["parties"];
  suggestedPartyId?: string;
  suggestedInvoice: Extract<AppDataState, { state: "ready" }>["invoices"][number] | null;
  suggestedSupplierInvoice:
    | Extract<AppDataState, { state: "ready" }>["supplierInvoices"][number]
    | null;
  isMatchingInvoice: boolean;
  isMatchingSupplierInvoice: boolean;
  isPostingBankFee: boolean;
  isUndoingPosting: boolean;
  onCreateCounterparty: () => void;
  onMatchInvoice: (invoiceId: string) => void;
  onMatchSupplierInvoice: (supplierInvoiceId: string) => void;
  onPostBankFee: () => void;
  onLinkCounterparty: () => void;
  onLinkedPartyChange: (partyId: string) => void;
  onUndoPosting: () => void;
}) {
  const linkedParty = parties.find((party) => party.id === bankTransaction.partyId);
  const details = [
    ["Bank account", bankAccountName],
    ["Linked counterparty", linkedParty?.name],
    ["Booking date", bankTransaction.bookingDate],
    ["Value date", bankTransaction.valueDate],
    ["Amount", `${bankTransaction.amount} ${bankTransaction.currency}`],
    ["Status", bankTransaction.status],
    ["Description", bankTransaction.description],
    ["Reference", bankTransaction.reference],
    ["Statement counterparty", bankTransaction.counterpartyName],
    ["Statement counterparty IBAN", bankTransaction.counterpartyIban],
    ["Remittance", bankTransaction.remittanceInformation],
    ["Bank reference", bankTransaction.bankReference],
    ["Entry reference", bankTransaction.entryReference],
    ["Import source", bankTransaction.importSource],
    ["External ID", bankTransaction.externalId]
  ].filter(([, value]) => Boolean(value));

  return (
    <div className="transaction-detail-panel">
      <div className="subsection-header">
        <div>
          <h3>Selected transaction details</h3>
          <p>Bank statement data is shown as read-only text for copying.</p>
        </div>
      </div>
      <dl className="copyable-details">
        {details.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="transaction-detail-actions">
        <Link
          className="secondary-button"
          to="/workspace/banking/accounts/$bankAccountId"
          params={{ bankAccountId }}
        >
          Open bank account
        </Link>
        {linkedParty ? (
          <Link
            className="secondary-button"
            to="/workspace/counterparties/$partyId"
            params={{ partyId: linkedParty.id }}
          >
            Open counterparty
          </Link>
        ) : null}
        {bankTransaction.matchedDocumentType === "invoice" &&
        bankTransaction.matchedDocumentId ? (
          <Link
            className="secondary-button"
            to="/workspace/sales/invoices/$invoiceId"
            params={{ invoiceId: bankTransaction.matchedDocumentId }}
          >
            Open invoice
          </Link>
        ) : null}
        {bankTransaction.matchedDocumentType === "supplier_invoice" &&
        bankTransaction.matchedDocumentId ? (
          <Link
            className="secondary-button"
            to="/workspace/purchases/supplier-invoices/$supplierInvoiceId"
            params={{ supplierInvoiceId: bankTransaction.matchedDocumentId }}
          >
            Open supplier invoice
          </Link>
        ) : null}
      </div>
      {bankTransaction.importSource ? (
        <div className="transaction-detail-actions">
          <label className="inline-select">
            <span>Link counterparty</span>
            <select
              value={linkedPartyId}
              disabled={bankTransaction.status !== "unmatched" || isLinkingCounterparty}
              onChange={(event) => onLinkedPartyChange(event.target.value)}
            >
              <option value="">No linked counterparty</option>
              {parties
                .filter((party) => party.active)
                .map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.name}
                    {party.iban ? ` · ${party.iban}` : ""}
                  </option>
                ))}
            </select>
          </label>
          <button
            className="secondary-button"
            type="button"
            disabled={bankTransaction.status !== "unmatched" || isLinkingCounterparty}
            onClick={onLinkCounterparty}
          >
            {isLinkingCounterparty ? "Linking" : "Link counterparty"}
          </button>
          {suggestedPartyId && !bankTransaction.partyId ? (
            <p className="field-note">
              Suggested by matching statement counterparty name or IBAN.
            </p>
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
      {bankTransaction.importSource && bankTransaction.counterpartyName ? (
        <div className="transaction-detail-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={!canCreateCounterparty || isCreatingCounterparty}
            onClick={onCreateCounterparty}
          >
            {isCreatingCounterparty ? "Creating counterparty" : "Create counterparty"}
          </button>
          {counterpartyExists ? (
            <p className="field-note">A counterparty with this name or IBAN already exists.</p>
          ) : null}
        </div>
      ) : null}
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
  activeBankAccounts: Extract<AppDataState, { state: "ready" }>["bankAccounts"];
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

function getBankTransactionRoute(pathname: string): BankTransactionRoute {
  const [, workspace, banking, transactions, bankTransactionId, mode] = pathname.split("/");

  if (workspace !== "workspace" || banking !== "banking" || transactions !== "transactions") {
    return { mode: "list" };
  }

  if (!bankTransactionId) {
    return { mode: "list" };
  }

  if (bankTransactionId === "new") {
    return { mode: "create" };
  }

  if (mode === "edit") {
    return { mode: "edit", bankTransactionId };
  }

  return { mode: "detail", bankTransactionId };
}

function getBankTransactionListFilters(searchStr: string) {
  const searchParams = new URLSearchParams(searchStr);
  const status = searchParams.get("status");

  return {
    bankAccountId: searchParams.get("bankAccountId") ?? "",
    status:
      status === "unmatched" ||
      status === "matched" ||
      status === "posted" ||
      status === "ignored"
        ? status
        : ""
  };
}
