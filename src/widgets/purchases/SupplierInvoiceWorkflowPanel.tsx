import { useEffect, useState, type FormEvent } from "react";
import type { AppDataState } from "../../app/App";
import { LinkedBankTransactionSummary } from "../../entities/bank-transaction/LinkedBankTransactionSummary";
import { LinkedJournalEntries } from "../../entities/journal/LinkedJournalEntries";
import { PartyInvoiceDetails } from "../../entities/party/PartyInvoiceDetails";
import {
  matchSupplierPaymentFromBankTransaction,
  undoBankTransactionPosting
} from "../../services/bank-workflow";
import {
  createSupplierInvoice,
  deleteSupplierInvoice,
  updateSupplierInvoice
} from "../../services/supplier-invoice-workflow";
import { mapOverviewToReadyState } from "../../shared/lib/workspace-overview";

export function SupplierInvoiceWorkflowPanel({
  data,
  onDataStateChange
}: {
  data: Extract<AppDataState, { state: "ready" }>;
  onDataStateChange: (state: AppDataState) => void;
}) {
  const supplierParties = data.parties.filter(
    (party) => party.active && party.roles.includes("supplier")
  );
  const [partyId, setPartyId] = useState(supplierParties[0]?.id ?? "");
  const [number, setNumber] = useState("SUP-2026-0001");
  const [issueDate, setIssueDate] = useState("2026-05-10");
  const [total, setTotal] = useState("40.00");
  const [selectedSupplierInvoiceId, setSelectedSupplierInvoiceId] = useState(
    data.supplierInvoice?.id ?? ""
  );
  const [
    selectedSupplierPaymentBankTransactionId,
    setSelectedSupplierPaymentBankTransactionId
  ] = useState("");
  const [actionState, setActionState] = useState<
    "idle" | "saving" | "updating" | "deleting" | "paying" | "undo"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedSupplierInvoice =
    data.supplierInvoices.find(
      (supplierInvoice) => supplierInvoice.id === selectedSupplierInvoiceId
    ) ??
    data.supplierInvoice ??
    null;
  const selectedSupplierInvoiceParty = selectedSupplierInvoice
    ? data.parties.find((party) => party.id === selectedSupplierInvoice.partyId) ?? null
    : null;
  const selectedSupplierInvoiceEntries = selectedSupplierInvoice
    ? data.journalEntries.filter((entry) =>
        entry.lines.some((line) => line.supplierInvoiceId === selectedSupplierInvoice.id)
      )
    : [];
  const outgoingBankTransactions = data.bankTransactions.filter(
    (bankTransaction) =>
      bankTransaction.status === "unmatched" && bankTransaction.amount.startsWith("-")
  );
  const linkedSupplierBankTransaction = selectedSupplierInvoice
    ? data.bankTransactions.find(
        (bankTransaction) =>
          bankTransaction.matchedDocumentType === "supplier_invoice" &&
          bankTransaction.matchedDocumentId === selectedSupplierInvoice.id
      ) ?? null
    : null;
  const selectedOutgoingBankTransactionId =
    selectedSupplierPaymentBankTransactionId || outgoingBankTransactions[0]?.id || "";
  const [editPartyId, setEditPartyId] = useState(selectedSupplierInvoice?.partyId ?? "");
  const [editNumber, setEditNumber] = useState(selectedSupplierInvoice?.number ?? "");
  const [editIssueDate, setEditIssueDate] = useState(
    selectedSupplierInvoice?.issueDate ?? ""
  );
  const [editTotal, setEditTotal] = useState(selectedSupplierInvoice?.total ?? "");
  const [editExpenseAccountCode, setEditExpenseAccountCode] = useState(
    selectedSupplierInvoice?.expenseAccountCode ?? "4100"
  );

  useEffect(() => {
    if (!selectedSupplierInvoice) return;

    setEditPartyId(selectedSupplierInvoice.partyId);
    setEditNumber(selectedSupplierInvoice.number);
    setEditIssueDate(selectedSupplierInvoice.issueDate);
    setEditTotal(selectedSupplierInvoice.total);
    setEditExpenseAccountCode(selectedSupplierInvoice.expenseAccountCode);
  }, [selectedSupplierInvoice]);

  async function handleCreateSupplierInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionState("saving");
    setErrorMessage(null);

    try {
      if (!partyId) {
        throw new Error("Select a supplier counterparty first.");
      }

      const overview = await createSupplierInvoice({
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
      setSelectedSupplierInvoiceId(overview.latestSupplierInvoice?.id ?? "");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Supplier invoice was not created."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleRecordSupplierPayment() {
    if (!selectedSupplierInvoice) return;

    setActionState("paying");
    setErrorMessage(null);

    try {
      if (!selectedOutgoingBankTransactionId) {
        throw new Error("Select an outgoing bank transaction first.");
      }

      const overview = await matchSupplierPaymentFromBankTransaction(
        selectedSupplierInvoice.id,
        selectedOutgoingBankTransactionId
      );

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedSupplierInvoiceId(
        overview.latestSupplierInvoice?.id ?? selectedSupplierInvoice.id
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Supplier payment was not recorded."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleUndoSupplierPayment() {
    if (!linkedSupplierBankTransaction) return;

    setActionState("undo");
    setErrorMessage(null);

    try {
      const overview = await undoBankTransactionPosting(linkedSupplierBankTransaction.id);

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedSupplierInvoiceId(selectedSupplierInvoice?.id ?? "");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Supplier payment was not undone."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleUpdateSupplierInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedSupplierInvoice) return;

    setActionState("updating");
    setErrorMessage(null);

    try {
      const overview = await updateSupplierInvoice({
        supplierInvoiceId: selectedSupplierInvoice.id,
        partyId: editPartyId,
        number: editNumber,
        issueDate: editIssueDate,
        total: editTotal,
        expenseAccountCode: editExpenseAccountCode
      });

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedSupplierInvoiceId(selectedSupplierInvoice.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Supplier invoice was not updated."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleDeleteSupplierInvoice() {
    if (!selectedSupplierInvoice) return;

    setActionState("deleting");
    setErrorMessage(null);

    try {
      const overview = await deleteSupplierInvoice(selectedSupplierInvoice.id);

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedSupplierInvoiceId(overview.latestSupplierInvoice?.id ?? "");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Supplier invoice was not deleted."
      );
    } finally {
      setActionState("idle");
    }
  }

  return (
    <section className="panel" aria-labelledby="supplier-invoice-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Purchases</p>
          <h2 id="supplier-invoice-title">Supplier invoice</h2>
        </div>
        {selectedSupplierInvoice ? (
          <span className="status-pill">{selectedSupplierInvoice.status}</span>
        ) : null}
      </div>

      <form
        className="invoice-form"
        onSubmit={(event) => void handleCreateSupplierInvoice(event)}
      >
        <label>
          <span>Supplier</span>
          <select
            value={partyId}
            onChange={(event) => setPartyId(event.target.value)}
          >
            <option value="">Select supplier</option>
            {supplierParties.map((party) => (
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
          {actionState === "saving" ? "Receiving" : "Receive invoice"}
        </button>
      </form>

      <div className="document-split">
        <div className="document-list" aria-label="Supplier invoices">
          {data.supplierInvoices.length === 0 ? (
            <p className="empty-state">No supplier invoices yet.</p>
          ) : null}
          {data.supplierInvoices.map((supplierInvoice) => (
            <button
              className={`document-list-item ${
                selectedSupplierInvoice?.id === supplierInvoice.id
                  ? "document-list-item-active"
                  : ""
              }`}
              key={supplierInvoice.id}
              type="button"
              onClick={() => setSelectedSupplierInvoiceId(supplierInvoice.id)}
            >
              <strong>{supplierInvoice.number}</strong>
              <span>
                {supplierInvoice.total} {supplierInvoice.currency} ·{" "}
                {supplierInvoice.status}
              </span>
            </button>
          ))}
        </div>

        {selectedSupplierInvoice ? (
        <div className="invoice-summary document-detail">
          <dl className="detail-list">
            <div>
              <dt>Selected supplier invoice</dt>
              <dd>{selectedSupplierInvoice.number}</dd>
            </div>
            <div>
              <dt>Supplier</dt>
              <PartyInvoiceDetails
                party={selectedSupplierInvoiceParty}
                fallbackLabel="Unknown supplier"
              />
            </div>
            <div>
              <dt>Issue date</dt>
              <dd>{selectedSupplierInvoice.issueDate}</dd>
            </div>
            <div>
              <dt>Expense account</dt>
              <dd className="code-cell">{selectedSupplierInvoice.expenseAccountCode}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>
                {selectedSupplierInvoice.total} {selectedSupplierInvoice.currency}
              </dd>
            </div>
          </dl>
          <LinkedJournalEntries entries={selectedSupplierInvoiceEntries} />
          <form
            className="invoice-form"
            onSubmit={(event) => void handleUpdateSupplierInvoice(event)}
          >
            <label>
              <span>Edit supplier</span>
              <select
                value={editPartyId}
                disabled={selectedSupplierInvoice.status === "paid"}
                onChange={(event) => setEditPartyId(event.target.value)}
              >
                <option value="">Select supplier</option>
                {supplierParties.map((party) => (
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
                  disabled={selectedSupplierInvoice.status === "paid"}
                  onChange={(event) => setEditNumber(event.target.value)}
                />
              </label>
              <label>
                <span>Edit issue date</span>
                <input
                  type="date"
                  value={editIssueDate}
                  disabled={selectedSupplierInvoice.status === "paid"}
                  onChange={(event) => setEditIssueDate(event.target.value)}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                <span>Edit total</span>
                <input
                  inputMode="decimal"
                  value={editTotal}
                  disabled={selectedSupplierInvoice.status === "paid"}
                  onChange={(event) => setEditTotal(event.target.value)}
                />
              </label>
              <label>
                <span>Edit expense account</span>
                <input
                  value={editExpenseAccountCode}
                  disabled={selectedSupplierInvoice.status === "paid"}
                  onChange={(event) => setEditExpenseAccountCode(event.target.value)}
                />
              </label>
            </div>
            {selectedSupplierInvoice.status === "paid" ? (
              <p className="field-note">
                Paid supplier invoices cannot be edited. Undo payment first.
              </p>
            ) : null}
            <div className="transaction-detail-actions">
              <button
                className="secondary-button"
                type="submit"
                disabled={actionState !== "idle" || selectedSupplierInvoice.status === "paid"}
              >
                {actionState === "updating"
                  ? "Saving supplier invoice"
                  : "Save supplier invoice"}
              </button>
              <button
                className="secondary-button danger-button"
                type="button"
                disabled={actionState !== "idle" || selectedSupplierInvoice.status === "paid"}
                onClick={() => void handleDeleteSupplierInvoice()}
              >
                {actionState === "deleting"
                  ? "Deleting supplier invoice"
                  : "Delete supplier invoice"}
              </button>
            </div>
          </form>
          {linkedSupplierBankTransaction ? (
            <LinkedBankTransactionSummary
              label="Linked outgoing bank transaction"
              bankTransaction={linkedSupplierBankTransaction}
              onUndo={() => void handleUndoSupplierPayment()}
              undoDisabled={actionState !== "idle"}
              undoLabel={
                actionState === "undo" ? "Undoing supplier payment" : "Undo supplier payment"
              }
            />
          ) : (
            <>
              <label className="inline-select">
                <span>Outgoing bank transaction</span>
                <select
                  value={selectedOutgoingBankTransactionId}
                  onChange={(event) =>
                    setSelectedSupplierPaymentBankTransactionId(event.target.value)
                  }
                >
                  <option value="">Select transaction</option>
                  {outgoingBankTransactions.map((bankTransaction) => (
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
                disabled={actionState !== "idle" || selectedSupplierInvoice.status === "paid"}
                onClick={() => void handleRecordSupplierPayment()}
              >
                {selectedSupplierInvoice.status === "paid"
                  ? "Supplier payment recorded"
                  : "Record supplier payment"}
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
