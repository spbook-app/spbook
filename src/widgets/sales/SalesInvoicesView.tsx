import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { WorkspaceUpdateHandler } from "../../shared/model/workspace";
import type { BankTransaction, Invoice, Party } from "../../domain";
import type { SalesInvoicesViewProps } from "../../shared/model/widget-props";
import { LinkedBankTransactionSummary } from "../../entities/bank-transaction/LinkedBankTransactionSummary";
import { LinkedJournalEntries } from "../../entities/journal/LinkedJournalEntries";
import { PartyInvoiceDetails } from "../../entities/party/PartyInvoiceDetails";
import { InvoiceCreateForm } from "../../features/invoice-create/InvoiceCreateForm";
import {
  matchInvoicePaymentFromBankTransaction,
  undoBankTransactionPosting
} from "../../services/bank-workflow";
import {
  deleteSalesInvoice,
  updateSalesInvoice
} from "../../services/invoice-workflow";
import { InvoiceEditableFields } from "../../entities/invoice/InvoiceFields";

export type SalesInvoiceRoute =
  | { mode: "list" }
  | { mode: "create" }
  | { mode: "detail"; invoiceId: string }
  | { mode: "edit"; invoiceId: string };

export function SalesInvoicesView(props: SalesInvoicesViewProps & { route: SalesInvoiceRoute }) {
  const {
    workspace,
    invoices,
    parties,
    bankTransactions,
    journalEntries,
    onWorkspaceUpdate,
    route
  } = props;
  const customerParties = useMemo(
    () => parties.filter((party) => party.active && party.roles.includes("customer")),
    [parties]
  );

  if (route.mode === "create") {
    return (
      <InvoiceCreateForm
        baseCurrency={workspace.baseCurrency}
        customerParties={customerParties}
        onWorkspaceUpdate={onWorkspaceUpdate}
        workspaceId={workspace.id}
      />
    );
  }

  if (route.mode === "detail" || route.mode === "edit") {
    const invoice = invoices.find((candidate) => candidate.id === route.invoiceId) ?? null;

    if (!invoice) {
      return <InvoiceNotFound invoiceId={route.invoiceId} />;
    }

    return (
      <InvoiceDetailPage
        bankTransactions={bankTransactions}
        customerParties={customerParties}
        invoice={invoice}
        journalEntries={journalEntries}
        mode={route.mode}
        onWorkspaceUpdate={onWorkspaceUpdate}
        parties={parties}
      />
    );
  }

  return <InvoiceListPage invoices={invoices} parties={parties} />;
}

function InvoiceListPage({ invoices, parties }: { invoices: Invoice[]; parties: Party[] }) {
  return (
    <section className="panel" aria-labelledby="sales-invoices-title">
      <div className="panel-header">
        <h2 id="sales-invoices-title">Issued invoices</h2>
        <Link className="primary-button" to="/workspace/sales/invoices/new">
          Create invoice
        </Link>
      </div>

      <div className="document-list" aria-label="Issued invoices">
        {invoices.length === 0 ? (
          <p className="empty-state">No issued invoices yet.</p>
        ) : null}
        {invoices.map((invoice) => {
          const party = parties.find((candidate) => candidate.id === invoice.partyId);

          return (
            <Link
              className="document-list-item"
              key={invoice.id}
              to="/workspace/sales/invoices/$invoiceId"
              params={{ invoiceId: invoice.id }}
            >
              <strong>{invoice.number}</strong>
              <span>
                {party?.name ?? "Unknown customer"} · {invoice.issueDate} · {invoice.total}{" "}
                {invoice.currency} · {invoice.status}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function InvoiceDetailPage({
  bankTransactions,
  customerParties,
  invoice,
  journalEntries,
  mode,
  onWorkspaceUpdate,
  parties
}: {
  bankTransactions: BankTransaction[];
  customerParties: Party[];
  invoice: Invoice;
  journalEntries: SalesInvoicesViewProps["journalEntries"];
  mode: "detail" | "edit";
  onWorkspaceUpdate: WorkspaceUpdateHandler;
  parties: Party[];
}) {
  const navigate = useNavigate();
  const [actionState, setActionState] = useState<
    "idle" | "updating" | "deleting" | "paying" | "undo"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedPaymentBankTransactionId, setSelectedPaymentBankTransactionId] =
    useState("");
  const [editPartyId, setEditPartyId] = useState(invoice.partyId);
  const [editNumber, setEditNumber] = useState(invoice.number);
  const [editIssueDate, setEditIssueDate] = useState(invoice.issueDate);
  const [editTotal, setEditTotal] = useState(invoice.total);
  const invoiceParty = parties.find((party) => party.id === invoice.partyId) ?? null;
  const invoiceEntries = journalEntries.filter((entry) =>
    entry.lines.some((line) => line.invoiceId === invoice.id)
  );
  const linkedInvoiceBankTransaction =
    bankTransactions.find(
      (bankTransaction) =>
        bankTransaction.matchedDocumentType === "invoice" &&
        bankTransaction.matchedDocumentId === invoice.id
    ) ?? null;
  const paymentCandidates = getIncomingPaymentCandidates(bankTransactions, invoice);
  const selectedIncomingBankTransactionId =
    selectedPaymentBankTransactionId || paymentCandidates[0]?.id || "";

  useEffect(() => {
    setEditPartyId(invoice.partyId);
    setEditNumber(invoice.number);
    setEditIssueDate(invoice.issueDate);
    setEditTotal(invoice.total);
  }, [invoice]);

  async function handleRecordPayment() {
    setActionState("paying");
    setErrorMessage(null);

    try {
      if (!selectedIncomingBankTransactionId) {
        throw new Error("Select an incoming bank transaction first.");
      }

      const update = await matchInvoicePaymentFromBankTransaction(
        invoice.id,
        selectedIncomingBankTransactionId
      );

      onWorkspaceUpdate(update);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Payment was not recorded.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleUndoPayment() {
    if (!linkedInvoiceBankTransaction) return;

    setActionState("undo");
    setErrorMessage(null);

    try {
      const update = await undoBankTransactionPosting(linkedInvoiceBankTransaction.id);

      onWorkspaceUpdate(update);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Payment was not undone.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleUpdateInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionState("updating");
    setErrorMessage(null);

    try {
      const update = await updateSalesInvoice({
        invoiceId: invoice.id,
        partyId: editPartyId,
        number: editNumber,
        issueDate: editIssueDate,
        total: editTotal
      });

      onWorkspaceUpdate(update);
      void navigate({
        to: "/workspace/sales/invoices/$invoiceId",
        params: { invoiceId: invoice.id }
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Invoice was not updated.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleDeleteInvoice() {
    setActionState("deleting");
    setErrorMessage(null);

    try {
      const update = await deleteSalesInvoice(invoice.id);

      onWorkspaceUpdate(update);
      void navigate({ to: "/workspace/sales/invoices" });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Invoice was not deleted.");
    } finally {
      setActionState("idle");
    }
  }

  return (
    <section className="panel" aria-labelledby="invoice-detail-title">
      <div className="panel-header">
        <h2 id="invoice-detail-title">Invoice {invoice.number}</h2>
        <span className="status-pill">{invoice.status}</span>
      </div>

      <div className="transaction-detail-actions">
        {mode === "edit" ? (
          <Link
            className="secondary-button"
            to="/workspace/sales/invoices/$invoiceId"
            params={{ invoiceId: invoice.id }}
          >
            Cancel
          </Link>
        ) : null}
        {mode === "detail" && invoice.status !== "paid" ? (
          <Link
            className="secondary-button"
            to="/workspace/sales/invoices/$invoiceId/edit"
            params={{ invoiceId: invoice.id }}
          >
            Edit invoice
          </Link>
        ) : null}
      </div>

      {mode === "edit" ? (
        <form className="invoice-form" onSubmit={(event) => void handleUpdateInvoice(event)}>
          <InvoiceEditableFields
            currency={invoice.currency}
            customerParties={customerParties}
            disabled={invoice.status === "paid"}
            issueDate={editIssueDate}
            number={editNumber}
            partyId={editPartyId}
            total={editTotal}
            onIssueDateChange={setEditIssueDate}
            onNumberChange={setEditNumber}
            onPartyIdChange={setEditPartyId}
            onTotalChange={setEditTotal}
          />
          {invoice.status === "paid" ? (
            <p className="field-note">Paid invoices cannot be edited. Undo payment first.</p>
          ) : null}
          <div className="transaction-detail-actions">
            <button
              className="primary-button"
              type="submit"
              disabled={actionState !== "idle" || invoice.status === "paid"}
            >
              {actionState === "updating" ? "Saving invoice" : "Save invoice"}
            </button>
            <Link
              className="secondary-button"
              to="/workspace/sales/invoices/$invoiceId"
              params={{ invoiceId: invoice.id }}
            >
              Cancel
            </Link>
          </div>
        </form>
      ) : (
        <>
          <div className="invoice-summary document-detail">
            <dl className="detail-list">
              <div>
                <dt>Invoice</dt>
                <dd>{invoice.number}</dd>
              </div>
              <div>
                <dt>Customer</dt>
                <PartyInvoiceDetails
                  party={invoiceParty}
                  fallbackLabel="Unknown customer"
                />
              </div>
              <div>
                <dt>Issue date</dt>
                <dd>{invoice.issueDate}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>
                  {invoice.total} {invoice.currency}
                </dd>
              </div>
            </dl>
          </div>
          {invoiceParty ? (
            <div className="transaction-detail-actions">
              <Link
                className="secondary-button"
                to="/workspace/counterparties/$partyId"
                params={{ partyId: invoiceParty.id }}
              >
                Open customer
              </Link>
            </div>
          ) : null}
          <LinkedJournalEntries entries={invoiceEntries} />
          {linkedInvoiceBankTransaction ? (
            <LinkedBankTransactionSummary
              label="Linked incoming bank transaction"
              bankTransaction={linkedInvoiceBankTransaction}
              onUndo={() => void handleUndoPayment()}
              undoDisabled={actionState !== "idle"}
              undoLabel={actionState === "undo" ? "Undoing payment" : "Undo payment"}
            />
          ) : (
            <>
              <label className="inline-select">
                <span>Incoming bank transaction</span>
                <select
                  value={selectedIncomingBankTransactionId}
                  onChange={(event) => setSelectedPaymentBankTransactionId(event.target.value)}
                >
                  <option value="">Select transaction</option>
                  {paymentCandidates.map((bankTransaction) => (
                    <option key={bankTransaction.id} value={bankTransaction.id}>
                      {bankTransaction.bookingDate} · {bankTransaction.amount} ·{" "}
                      {bankTransaction.description}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="secondary-button"
                type="button"
                disabled={actionState !== "idle" || invoice.status === "paid"}
                onClick={() => void handleRecordPayment()}
              >
                {invoice.status === "paid" ? "Payment recorded" : "Record payment"}
              </button>
            </>
          )}
          {invoice.status !== "paid" ? (
            <button
              className="secondary-button danger-button"
              type="button"
              disabled={actionState !== "idle"}
              onClick={() => void handleDeleteInvoice()}
            >
              {actionState === "deleting" ? "Deleting invoice" : "Delete invoice"}
            </button>
          ) : null}
        </>
      )}

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </section>
  );
}

function InvoiceNotFound({ invoiceId }: { invoiceId: string }) {
  return (
    <section className="panel" aria-labelledby="invoice-not-found-title">
      <div className="panel-header">
        <h2 id="invoice-not-found-title">Invoice not found</h2>
        <Link className="secondary-button" to="/workspace/sales/invoices">
          Back to list
        </Link>
      </div>
      <p className="empty-state">Invoice "{invoiceId}" does not exist in this workspace.</p>
    </section>
  );
}


function getIncomingPaymentCandidates(
  bankTransactions: BankTransaction[],
  invoice: Invoice
) {
  return bankTransactions
    .filter(
      (bankTransaction) =>
        bankTransaction.status === "unmatched" && !bankTransaction.amount.startsWith("-")
    )
    .sort((left, right) => {
      const leftScore = getPaymentCandidateScore(left, invoice);
      const rightScore = getPaymentCandidateScore(right, invoice);

      return rightScore - leftScore;
    });
}

function getPaymentCandidateScore(bankTransaction: BankTransaction, invoice: Invoice) {
  let score = 0;

  if (bankTransaction.partyId === invoice.partyId) {
    score += 2;
  }

  if (Number(bankTransaction.amount) === Number(invoice.total)) {
    score += 1;
  }

  return score;
}
