import { useEffect, useState, type FormEvent } from "react";
import type { AppDataState } from "../../app/App";
import { LinkedBankTransactionSummary } from "../../entities/bank-transaction/LinkedBankTransactionSummary";
import { LinkedJournalEntries } from "../../entities/journal/LinkedJournalEntries";
import { PartyInvoiceDetails } from "../../entities/party/PartyInvoiceDetails";
import {
  matchInvoicePaymentFromBankTransaction,
  undoBankTransactionPosting
} from "../../services/bank-workflow";
import {
  createSalesInvoice,
  deleteSalesInvoice,
  updateSalesInvoice
} from "../../services/invoice-workflow";
import { mapOverviewToReadyState } from "../../shared/lib/workspace-overview";

export function InvoiceWorkflowPanel({
  data,
  onDataStateChange
}: {
  data: Extract<AppDataState, { state: "ready" }>;
  onDataStateChange: (state: AppDataState) => void;
}) {
  const customerParties = data.parties.filter(
    (party) => party.active && party.roles.includes("customer")
  );
  const [partyId, setPartyId] = useState(customerParties[0]?.id ?? "");
  const [number, setNumber] = useState("2026-0001");
  const [issueDate, setIssueDate] = useState("2026-05-10");
  const [total, setTotal] = useState("1000.00");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(data.invoice?.id ?? "");
  const [selectedPaymentBankTransactionId, setSelectedPaymentBankTransactionId] =
    useState("");
  const [actionState, setActionState] = useState<
    "idle" | "saving" | "updating" | "deleting" | "paying" | "undo"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedInvoice =
    data.invoices.find((invoice) => invoice.id === selectedInvoiceId) ??
    data.invoice ??
    null;
  const selectedInvoiceParty = selectedInvoice
    ? data.parties.find((party) => party.id === selectedInvoice.partyId) ?? null
    : null;
  const selectedInvoiceEntries = selectedInvoice
    ? data.journalEntries.filter((entry) =>
        entry.lines.some((line) => line.invoiceId === selectedInvoice.id)
      )
    : [];
  const incomingBankTransactions = data.bankTransactions.filter(
    (bankTransaction) =>
      bankTransaction.status === "unmatched" && !bankTransaction.amount.startsWith("-")
  );
  const linkedInvoiceBankTransaction = selectedInvoice
    ? data.bankTransactions.find(
        (bankTransaction) =>
          bankTransaction.matchedDocumentType === "invoice" &&
          bankTransaction.matchedDocumentId === selectedInvoice.id
      ) ?? null
    : null;
  const selectedIncomingBankTransactionId =
    selectedPaymentBankTransactionId || incomingBankTransactions[0]?.id || "";
  const [editPartyId, setEditPartyId] = useState(selectedInvoice?.partyId ?? "");
  const [editNumber, setEditNumber] = useState(selectedInvoice?.number ?? "");
  const [editIssueDate, setEditIssueDate] = useState(selectedInvoice?.issueDate ?? "");
  const [editTotal, setEditTotal] = useState(selectedInvoice?.total ?? "");

  useEffect(() => {
    if (!selectedInvoice) return;

    setEditPartyId(selectedInvoice.partyId);
    setEditNumber(selectedInvoice.number);
    setEditIssueDate(selectedInvoice.issueDate);
    setEditTotal(selectedInvoice.total);
  }, [selectedInvoice]);

  async function handleCreateInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionState("saving");
    setErrorMessage(null);

    try {
      if (!partyId) {
        throw new Error("Select a customer counterparty first.");
      }

      const overview = await createSalesInvoice({
        workspaceId: data.workspace.id,
        partyId,
        number,
        issueDate,
        total,
        currency: data.workspace.baseCurrency
      });

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedInvoiceId(overview.latestInvoice?.id ?? "");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Invoice was not created.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleRecordPayment() {
    if (!selectedInvoice) return;

    setActionState("paying");
    setErrorMessage(null);

    try {
      if (!selectedIncomingBankTransactionId) {
        throw new Error("Select an incoming bank transaction first.");
      }

      const overview = await matchInvoicePaymentFromBankTransaction(
        selectedInvoice.id,
        selectedIncomingBankTransactionId
      );

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedInvoiceId(overview.latestInvoice?.id ?? selectedInvoice.id);
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
      const overview = await undoBankTransactionPosting(linkedInvoiceBankTransaction.id);

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedInvoiceId(selectedInvoice?.id ?? "");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Payment was not undone.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleUpdateInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedInvoice) return;

    setActionState("updating");
    setErrorMessage(null);

    try {
      const overview = await updateSalesInvoice({
        invoiceId: selectedInvoice.id,
        partyId: editPartyId,
        number: editNumber,
        issueDate: editIssueDate,
        total: editTotal
      });

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedInvoiceId(selectedInvoice.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Invoice was not updated.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleDeleteInvoice() {
    if (!selectedInvoice) return;

    setActionState("deleting");
    setErrorMessage(null);

    try {
      const overview = await deleteSalesInvoice(selectedInvoice.id);

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedInvoiceId(overview.latestInvoice?.id ?? "");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Invoice was not deleted.");
    } finally {
      setActionState("idle");
    }
  }

  return (
    <section className="panel" aria-labelledby="invoice-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Sales</p>
          <h2 id="invoice-title">Create invoice</h2>
        </div>
        {selectedInvoice ? <span className="status-pill">{selectedInvoice.status}</span> : null}
      </div>

      <form className="invoice-form" onSubmit={(event) => void handleCreateInvoice(event)}>
        <label>
          <span>Customer</span>
          <select
            value={partyId}
            onChange={(event) => setPartyId(event.target.value)}
          >
            <option value="">Select customer</option>
            {customerParties.map((party) => (
              <option key={party.id} value={party.id}>
                {party.name}
              </option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label>
            <span>Number</span>
            <input
              required
              value={number}
              onChange={(event) => setNumber(event.target.value)}
            />
          </label>
          <label>
            <span>Issue date</span>
            <input
              required
              type="date"
              value={issueDate}
              onChange={(event) => setIssueDate(event.target.value)}
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            <span>Total</span>
            <input
              required
              inputMode="decimal"
              value={total}
              onChange={(event) => setTotal(event.target.value)}
            />
          </label>
          <label>
            <span>Currency</span>
            <input readOnly value={data.workspace.baseCurrency} />
          </label>
        </div>
        <button className="primary-button" type="submit" disabled={actionState !== "idle"}>
          {actionState === "saving" ? "Creating" : "Create invoice"}
        </button>
      </form>

      <div className="document-split">
        <div className="document-list" aria-label="Issued invoices">
          {data.invoices.length === 0 ? (
            <p className="empty-state">No issued invoices yet.</p>
          ) : null}
          {data.invoices.map((invoice) => (
            <button
              className={`document-list-item ${
                selectedInvoice?.id === invoice.id ? "document-list-item-active" : ""
              }`}
              key={invoice.id}
              type="button"
              onClick={() => setSelectedInvoiceId(invoice.id)}
            >
              <strong>{invoice.number}</strong>
              <span>
                {invoice.total} {invoice.currency} · {invoice.status}
              </span>
            </button>
          ))}
        </div>

        {selectedInvoice ? (
        <div className="invoice-summary document-detail">
          <dl className="detail-list">
            <div>
              <dt>Selected invoice</dt>
              <dd>{selectedInvoice.number}</dd>
            </div>
            <div>
              <dt>Customer</dt>
              <PartyInvoiceDetails
                party={selectedInvoiceParty}
                fallbackLabel="Unknown customer"
              />
            </div>
            <div>
              <dt>Issue date</dt>
              <dd>{selectedInvoice.issueDate}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>
                {selectedInvoice.total} {selectedInvoice.currency}
              </dd>
            </div>
          </dl>
          <LinkedJournalEntries entries={selectedInvoiceEntries} />
          <form className="invoice-form" onSubmit={(event) => void handleUpdateInvoice(event)}>
            <label>
              <span>Edit customer</span>
              <select
                value={editPartyId}
                disabled={selectedInvoice.status === "paid"}
                onChange={(event) => setEditPartyId(event.target.value)}
              >
                <option value="">Select customer</option>
                {customerParties.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                <span>Edit number</span>
                <input
                  value={editNumber}
                  disabled={selectedInvoice.status === "paid"}
                  onChange={(event) => setEditNumber(event.target.value)}
                />
              </label>
              <label>
                <span>Edit issue date</span>
                <input
                  type="date"
                  value={editIssueDate}
                  disabled={selectedInvoice.status === "paid"}
                  onChange={(event) => setEditIssueDate(event.target.value)}
                />
              </label>
            </div>
            <label>
              <span>Edit total</span>
              <input
                inputMode="decimal"
                value={editTotal}
                disabled={selectedInvoice.status === "paid"}
                onChange={(event) => setEditTotal(event.target.value)}
              />
            </label>
            {selectedInvoice.status === "paid" ? (
              <p className="field-note">Paid invoices cannot be edited. Undo payment first.</p>
            ) : null}
            <div className="transaction-detail-actions">
              <button
                className="secondary-button"
                type="submit"
                disabled={actionState !== "idle" || selectedInvoice.status === "paid"}
              >
                {actionState === "updating" ? "Saving invoice" : "Save invoice"}
              </button>
              <button
                className="secondary-button danger-button"
                type="button"
                disabled={actionState !== "idle" || selectedInvoice.status === "paid"}
                onClick={() => void handleDeleteInvoice()}
              >
                {actionState === "deleting" ? "Deleting invoice" : "Delete invoice"}
              </button>
            </div>
          </form>
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
                  {incomingBankTransactions.map((bankTransaction) => (
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
                disabled={actionState !== "idle" || selectedInvoice.status === "paid"}
                onClick={() => void handleRecordPayment()}
              >
                {selectedInvoice.status === "paid" ? "Payment recorded" : "Record payment"}
              </button>
            </>
          )}
        </div>
        ) : null}
      </div>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </section>
  );
}
