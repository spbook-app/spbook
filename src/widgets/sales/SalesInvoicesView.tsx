import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { AppDataState } from "../../app/App";
import type { BankTransaction, Invoice, Party } from "../../domain";
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

type ReadyAppData = Extract<AppDataState, { state: "ready" }>;
type SalesInvoiceRoute =
  | { mode: "list" }
  | { mode: "create" }
  | { mode: "detail"; invoiceId: string }
  | { mode: "edit"; invoiceId: string };

export function SalesInvoicesView({
  data,
  onDataStateChange
}: {
  data: ReadyAppData;
  onDataStateChange: (state: AppDataState) => void;
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname
  });
  const route = getSalesInvoiceRoute(pathname);
  const customerParties = useMemo(
    () => data.parties.filter((party) => party.active && party.roles.includes("customer")),
    [data.parties]
  );

  if (route.mode === "create") {
    return (
      <InvoiceCreatePage
        customerParties={customerParties}
        data={data}
        onDataStateChange={onDataStateChange}
      />
    );
  }

  if (route.mode === "detail" || route.mode === "edit") {
    const invoice = data.invoices.find((candidate) => candidate.id === route.invoiceId) ?? null;

    if (!invoice) {
      return <InvoiceNotFound invoiceId={route.invoiceId} />;
    }

    return (
      <InvoiceDetailPage
        customerParties={customerParties}
        data={data}
        invoice={invoice}
        mode={route.mode}
        onDataStateChange={onDataStateChange}
      />
    );
  }

  return <InvoiceListPage data={data} />;
}

function InvoiceListPage({ data }: { data: ReadyAppData }) {
  return (
    <section className="panel" aria-labelledby="sales-invoices-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Sales</p>
          <h2 id="sales-invoices-title">Issued invoices</h2>
        </div>
        <Link className="primary-button" to="/workspace/sales/invoices/new">
          Create invoice
        </Link>
      </div>

      <div className="document-list" aria-label="Issued invoices">
        {data.invoices.length === 0 ? (
          <p className="empty-state">No issued invoices yet.</p>
        ) : null}
        {data.invoices.map((invoice) => {
          const party = data.parties.find((candidate) => candidate.id === invoice.partyId);

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

function InvoiceCreatePage({
  customerParties,
  data,
  onDataStateChange
}: {
  customerParties: Party[];
  data: ReadyAppData;
  onDataStateChange: (state: AppDataState) => void;
}) {
  const navigate = useNavigate();
  const [partyId, setPartyId] = useState(customerParties[0]?.id ?? "");
  const [number, setNumber] = useState("2026-0001");
  const [issueDate, setIssueDate] = useState("2026-05-10");
  const [total, setTotal] = useState("1000.00");
  const [actionState, setActionState] = useState<"idle" | "saving">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      const createdInvoice = overview.latestInvoice;

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });

      if (createdInvoice) {
        void navigate({
          to: "/workspace/sales/invoices/$invoiceId",
          params: { invoiceId: createdInvoice.id }
        });
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Invoice was not created.");
    } finally {
      setActionState("idle");
    }
  }

  return (
    <section className="panel" aria-labelledby="create-invoice-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Sales</p>
          <h2 id="create-invoice-title">Create invoice</h2>
        </div>
        <Link className="secondary-button" to="/workspace/sales/invoices">
          Back to list
        </Link>
      </div>

      <form className="invoice-form" onSubmit={(event) => void handleCreateInvoice(event)}>
        <InvoiceEditableFields
          currency={data.workspace.baseCurrency}
          customerParties={customerParties}
          issueDate={issueDate}
          number={number}
          partyId={partyId}
          total={total}
          onIssueDateChange={setIssueDate}
          onNumberChange={setNumber}
          onPartyIdChange={setPartyId}
          onTotalChange={setTotal}
        />
        <button className="primary-button" type="submit" disabled={actionState !== "idle"}>
          {actionState === "saving" ? "Creating" : "Create invoice"}
        </button>
      </form>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </section>
  );
}

function InvoiceDetailPage({
  customerParties,
  data,
  invoice,
  mode,
  onDataStateChange
}: {
  customerParties: Party[];
  data: ReadyAppData;
  invoice: Invoice;
  mode: "detail" | "edit";
  onDataStateChange: (state: AppDataState) => void;
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
  const invoiceParty = data.parties.find((party) => party.id === invoice.partyId) ?? null;
  const invoiceEntries = data.journalEntries.filter((entry) =>
    entry.lines.some((line) => line.invoiceId === invoice.id)
  );
  const linkedInvoiceBankTransaction =
    data.bankTransactions.find(
      (bankTransaction) =>
        bankTransaction.matchedDocumentType === "invoice" &&
        bankTransaction.matchedDocumentId === invoice.id
    ) ?? null;
  const paymentCandidates = getIncomingPaymentCandidates(data.bankTransactions, invoice);
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

      const overview = await matchInvoicePaymentFromBankTransaction(
        invoice.id,
        selectedIncomingBankTransactionId
      );

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
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
      const overview = await updateSalesInvoice({
        invoiceId: invoice.id,
        partyId: editPartyId,
        number: editNumber,
        issueDate: editIssueDate,
        total: editTotal
      });

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
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
      const overview = await deleteSalesInvoice(invoice.id);

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
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
        <div>
          <p className="eyebrow">Sales</p>
          <h2 id="invoice-detail-title">Invoice {invoice.number}</h2>
        </div>
        <span className="status-pill">{invoice.status}</span>
      </div>

      <div className="transaction-detail-actions">
        <Link className="secondary-button" to="/workspace/sales/invoices">
          Back to list
        </Link>
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

function InvoiceEditableFields({
  currency,
  customerParties,
  disabled = false,
  issueDate,
  number,
  partyId,
  total,
  onIssueDateChange,
  onNumberChange,
  onPartyIdChange,
  onTotalChange
}: {
  currency: string;
  customerParties: Party[];
  disabled?: boolean;
  issueDate: string;
  number: string;
  partyId: string;
  total: string;
  onIssueDateChange: (value: string) => void;
  onNumberChange: (value: string) => void;
  onPartyIdChange: (value: string) => void;
  onTotalChange: (value: string) => void;
}) {
  return (
    <>
      <label>
        <span>Customer</span>
        <select
          required
          value={partyId}
          disabled={disabled}
          onChange={(event) => onPartyIdChange(event.target.value)}
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
            disabled={disabled}
            onChange={(event) => onNumberChange(event.target.value)}
          />
        </label>
        <label>
          <span>Issue date</span>
          <input
            required
            type="date"
            value={issueDate}
            disabled={disabled}
            onChange={(event) => onIssueDateChange(event.target.value)}
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
            disabled={disabled}
            onChange={(event) => onTotalChange(event.target.value)}
          />
        </label>
        <label>
          <span>Currency</span>
          <input readOnly value={currency} />
        </label>
      </div>
    </>
  );
}

function InvoiceNotFound({ invoiceId }: { invoiceId: string }) {
  return (
    <section className="panel" aria-labelledby="invoice-not-found-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Sales</p>
          <h2 id="invoice-not-found-title">Invoice not found</h2>
        </div>
        <Link className="secondary-button" to="/workspace/sales/invoices">
          Back to list
        </Link>
      </div>
      <p className="empty-state">Invoice "{invoiceId}" does not exist in this workspace.</p>
    </section>
  );
}

function getSalesInvoiceRoute(pathname: string): SalesInvoiceRoute {
  const [, workspace, sales, invoices, invoiceId, mode] = pathname.split("/");

  if (workspace !== "workspace" || sales !== "sales" || invoices !== "invoices") {
    return { mode: "list" };
  }

  if (!invoiceId) {
    return { mode: "list" };
  }

  if (invoiceId === "new") {
    return { mode: "create" };
  }

  if (mode === "edit") {
    return { mode: "edit", invoiceId };
  }

  return { mode: "detail", invoiceId };
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
