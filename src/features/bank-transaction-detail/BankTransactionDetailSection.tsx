import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { BankAccount, BankTransaction, Invoice, Party, SupplierInvoice } from "../../domain";
import { BankTransactionEditableFields } from "../../entities/bank-transaction/BankTransactionFields";
import {
  linkBankTransactionParty,
  matchInvoicePaymentFromBankTransaction,
  matchSupplierPaymentFromBankTransaction,
  postBankFeeFromBankTransaction,
  undoBankTransactionPosting,
  updateBankTransaction
} from "../../services/bank-workflow";
import { createParty } from "../../services/party-workflow";
import type { WorkspaceUpdateHandler } from "../../shared/model/workspace";

function normalizeIbanForCompare(iban: string | undefined) {
  return iban?.replace(/\s+/g, "").toUpperCase() ?? "";
}

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

export function BankTransactionDetailSection({
  bankTransaction,
  bankAccounts,
  workspace,
  parties,
  invoices,
  supplierInvoices,
  mode,
  onWorkspaceUpdate
}: {
  bankTransaction: BankTransaction;
  bankAccounts: BankAccount[];
  workspace: { id: string; baseCurrency: string; countryCode: string };
  parties: Party[];
  invoices: Invoice[];
  supplierInvoices: SupplierInvoice[];
  mode: "detail" | "edit";
  onWorkspaceUpdate: WorkspaceUpdateHandler;
}) {
  const navigate = useNavigate();
  const activeBankAccounts = bankAccounts.filter((bankAccount) => bankAccount.active);
  const bankAccountName =
    bankAccounts.find((bankAccount) => bankAccount.id === bankTransaction.bankAccountId)
      ?.name ?? "Unknown account";
  const canEditTransaction =
    bankTransaction.status === "unmatched" && !bankTransaction.importSource;
  const isIncoming = !bankTransaction.amount.startsWith("-");

  const statementCounterpartyCandidate =
    parties.find((party) =>
      isSameStatementCounterparty(
        party.name,
        party.iban,
        bankTransaction.counterpartyName,
        bankTransaction.counterpartyIban
      )
    ) ?? null;
  const statementCounterpartyExists = statementCounterpartyCandidate !== null;
  const canCreateCounterparty = Boolean(
    bankTransaction.importSource &&
      bankTransaction.counterpartyName &&
      !statementCounterpartyExists
  );

  const suggestedInvoice =
    bankTransaction.status === "unmatched" && bankTransaction.partyId && isIncoming
      ? invoices.find(
          (invoice) =>
            invoice.partyId === bankTransaction.partyId &&
            invoice.status !== "paid" &&
            invoice.status !== "cancelled" &&
            invoice.currency === bankTransaction.currency &&
            invoice.total === bankTransaction.amount
        ) ?? null
      : null;

  const suggestedSupplierInvoice =
    bankTransaction.status === "unmatched" && bankTransaction.partyId && !isIncoming
      ? supplierInvoices.find(
          (supplierInvoice) =>
            supplierInvoice.partyId === bankTransaction.partyId &&
            supplierInvoice.status !== "paid" &&
            supplierInvoice.status !== "cancelled" &&
            supplierInvoice.currency === bankTransaction.currency &&
            supplierInvoice.total === bankTransaction.amount.slice(1)
        ) ?? null
      : null;

  const [editBankAccountId, setEditBankAccountId] = useState(bankTransaction.bankAccountId);
  const [editBookingDate, setEditBookingDate] = useState(bankTransaction.bookingDate);
  const [editTransactionAmount, setEditTransactionAmount] = useState(bankTransaction.amount);
  const [editReference, setEditReference] = useState(bankTransaction.reference ?? "");
  const [editDescription, setEditDescription] = useState(bankTransaction.description);
  const [actionState, setActionState] = useState<
    | "idle"
    | "updating"
    | "party-create"
    | "party-link"
    | "invoice-match"
    | "supplier-match"
    | "fee"
    | "undo"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setEditBankAccountId(bankTransaction.bankAccountId);
    setEditBookingDate(bankTransaction.bookingDate);
    setEditTransactionAmount(bankTransaction.amount);
    setEditReference(bankTransaction.reference ?? "");
    setEditDescription(bankTransaction.description);
  }, [bankTransaction]);

  async function handleCreateCounterparty() {
    setErrorMessage(null);

    try {
      if (!bankTransaction.counterpartyName) {
        throw new Error("Selected bank transaction has no counterparty name.");
      }

      if (statementCounterpartyExists) {
        throw new Error("Counterparty already exists.");
      }

      setActionState("party-create");
      const partiesUpdate = await createParty({
        workspaceId: workspace.id,
        name: bankTransaction.counterpartyName,
        type: "business",
        roles: [bankTransaction.amount.startsWith("-") ? "supplier" : "customer"],
        countryCode:
          bankTransaction.counterpartyIban?.slice(0, 2) ?? workspace.countryCode,
        iban: bankTransaction.counterpartyIban
      });
      const createdParty = partiesUpdate.parties?.find((party) =>
        isSameStatementCounterparty(
          party.name,
          party.iban,
          bankTransaction.counterpartyName,
          bankTransaction.counterpartyIban
        )
      );
      const linkedUpdate = createdParty
        ? await linkBankTransactionParty({
            bankTransactionId: bankTransaction.id,
            partyId: createdParty.id
          })
        : null;

      onWorkspaceUpdate(linkedUpdate ? { ...partiesUpdate, ...linkedUpdate } : partiesUpdate);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Counterparty was not created."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleLinkCounterparty() {
    setErrorMessage(null);

    try {
      setActionState("party-link");
      const update = await linkBankTransactionParty({
        bankTransactionId: bankTransaction.id,
        partyId: statementCounterpartyCandidate?.id
      });

      onWorkspaceUpdate(update);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Counterparty was not linked."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleUnlinkCounterparty() {
    setErrorMessage(null);

    try {
      setActionState("party-link");
      const update = await linkBankTransactionParty({
        bankTransactionId: bankTransaction.id,
        partyId: undefined
      });

      onWorkspaceUpdate(update);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Counterparty was not unlinked."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleMatchInvoice(invoiceId: string) {
    setActionState("invoice-match");
    setErrorMessage(null);

    try {
      const update = await matchInvoicePaymentFromBankTransaction(
        invoiceId,
        bankTransaction.id
      );

      onWorkspaceUpdate(update);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Invoice payment was not matched."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleMatchSupplierInvoice(supplierInvoiceId: string) {
    setActionState("supplier-match");
    setErrorMessage(null);

    try {
      const update = await matchSupplierPaymentFromBankTransaction(
        supplierInvoiceId,
        bankTransaction.id
      );

      onWorkspaceUpdate(update);
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

  async function handlePostBankFee() {
    setActionState("fee");
    setErrorMessage(null);

    try {
      const update = await postBankFeeFromBankTransaction(bankTransaction.id);

      onWorkspaceUpdate(update);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Bank fee was not posted.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleUndoPosting() {
    setActionState("undo");
    setErrorMessage(null);

    try {
      const update = await undoBankTransactionPosting(bankTransaction.id);

      onWorkspaceUpdate(update);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Posting was not undone.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleUpdateBankTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setActionState("updating");

    try {
      const update = await updateBankTransaction({
        bankTransactionId: bankTransaction.id,
        bankAccountId: editBankAccountId,
        bookingDate: editBookingDate,
        amount: editTransactionAmount,
        description: editDescription,
        reference: editReference
      });

      onWorkspaceUpdate(update);
      void navigate({
        to: "/workspace/banking/transactions/$bankTransactionId",
        params: { bankTransactionId: bankTransaction.id }
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Bank transaction was not updated."
      );
    } finally {
      setActionState("idle");
    }
  }

  return (
    <div className="banking-section">
      <div className="subsection-header">
        <div>
          <h3>Bank transaction</h3>
          <p>Review statement details, link counterparties, and match postings.</p>
        </div>
        <div className="transaction-detail-actions">
          {mode === "edit" ? (
            <Link
              className="secondary-button"
              to="/workspace/banking/transactions/$bankTransactionId"
              params={{ bankTransactionId: bankTransaction.id }}
            >
              Cancel
            </Link>
          ) : null}
          {mode === "detail" && canEditTransaction ? (
            <Link
              className="secondary-button"
              to="/workspace/banking/transactions/$bankTransactionId/edit"
              params={{ bankTransactionId: bankTransaction.id }}
            >
              Edit transaction
            </Link>
          ) : null}
        </div>
      </div>

      <BankTransactionDetailPanel
        key={bankTransaction.id}
        bankAccountId={bankTransaction.bankAccountId}
        bankAccountName={bankAccountName}
        bankTransaction={bankTransaction}
        canCreateCounterparty={canCreateCounterparty}
        isLinkingCounterparty={actionState === "party-link"}
        isCreatingCounterparty={actionState === "party-create"}
        parties={parties}
        suggestedPartyId={statementCounterpartyCandidate?.id}
        suggestedInvoice={suggestedInvoice}
        suggestedSupplierInvoice={suggestedSupplierInvoice}
        isMatchingInvoice={actionState === "invoice-match"}
        isMatchingSupplierInvoice={actionState === "supplier-match"}
        isPostingBankFee={actionState === "fee"}
        isUndoingPosting={actionState === "undo"}
        onCreateCounterparty={() => void handleCreateCounterparty()}
        onMatchInvoice={(invoiceId) => void handleMatchInvoice(invoiceId)}
        onMatchSupplierInvoice={(supplierInvoiceId) =>
          void handleMatchSupplierInvoice(supplierInvoiceId)
        }
        onPostBankFee={() => void handlePostBankFee()}
        onLinkCounterparty={() => void handleLinkCounterparty()}
        onUnlinkCounterparty={() => void handleUnlinkCounterparty()}
        onUndoPosting={() => void handleUndoPosting()}
      />

      {mode === "edit" ? (
        <form
          className="invoice-form edit-bank-account-form"
          onSubmit={(event) => void handleUpdateBankTransaction(event)}
        >
          <BankTransactionEditableFields
            activeBankAccounts={activeBankAccounts}
            bankAccountId={editBankAccountId}
            bookingDate={editBookingDate}
            description={editDescription}
            disabled={!canEditTransaction}
            reference={editReference}
            transactionAmount={editTransactionAmount}
            onBankAccountIdChange={setEditBankAccountId}
            onBookingDateChange={setEditBookingDate}
            onDescriptionChange={setEditDescription}
            onReferenceChange={setEditReference}
            onTransactionAmountChange={setEditTransactionAmount}
          />
          {bankTransaction.importSource ? (
            <p className="field-note">
              Imported bank statement entries cannot be edited. Match, post, or ignore them
              instead.
            </p>
          ) : null}
          {bankTransaction.status !== "unmatched" ? (
            <p className="field-note">
              Processed bank transactions cannot be edited after matching or posting.
            </p>
          ) : null}
          <div className="transaction-detail-actions">
            <button
              className="primary-button"
              type="submit"
              disabled={actionState !== "idle" || !canEditTransaction}
            >
              {actionState === "updating" ? "Saving" : "Save bank transaction"}
            </button>
            <Link
              className="secondary-button"
              to="/workspace/banking/transactions/$bankTransactionId"
              params={{ bankTransactionId: bankTransaction.id }}
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
  const hasToggle =
    Boolean(bankTransaction.counterpartyName) && Boolean(linkedParty || suggestedParty);
  const textDetails = (
    [
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
    ] as Array<[string, ReactNode]>
  ).filter(([, value]) => value != null);

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
