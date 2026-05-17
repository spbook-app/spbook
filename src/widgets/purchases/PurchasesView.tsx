import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { AppDataState } from "../../app/App";
import type { BankTransaction, Party, SupplierInvoice } from "../../domain";
import { LinkedBankTransactionSummary } from "../../entities/bank-transaction/LinkedBankTransactionSummary";
import { LinkedJournalEntries } from "../../entities/journal/LinkedJournalEntries";
import { PartyInvoiceDetails } from "../../entities/party/PartyInvoiceDetails";
import { SupplierInvoiceCreateForm } from "../../features/supplier-invoice-create/SupplierInvoiceCreateForm";
import { OwnerTransactionsPanel } from "../../features/owner-transaction/OwnerTransactionsPanel";
import {
  matchSupplierPaymentFromBankTransaction,
  undoBankTransactionPosting
} from "../../services/bank-workflow";
import {
  deleteSupplierInvoice,
  updateSupplierInvoice
} from "../../services/supplier-invoice-workflow";
import { SupplierInvoiceEditableFields } from "../../entities/supplier-invoice/SupplierInvoiceFields";
import { mapOverviewToReadyState } from "../../shared/lib/workspace-overview";

type ReadyAppData = Extract<AppDataState, { state: "ready" }>;
type PurchaseRoute =
  | { mode: "supplier-list" }
  | { mode: "supplier-create" }
  | { mode: "supplier-detail"; supplierInvoiceId: string }
  | { mode: "supplier-edit"; supplierInvoiceId: string }
  | { mode: "owner-create" };

export function PurchasesView({
  data,
  onDataStateChange
}: {
  data: ReadyAppData;
  onDataStateChange: (state: AppDataState) => void;
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname
  });
  const route = getPurchaseRoute(pathname);
  const supplierParties = useMemo(
    () => data.parties.filter((party) => party.active && party.roles.includes("supplier")),
    [data.parties]
  );

  if (route.mode === "owner-create") {
    return <OwnerTransactionsPanel data={data} onDataStateChange={onDataStateChange} />;
  }

  if (route.mode === "supplier-create") {
    return (
      <SupplierInvoiceCreateForm
        data={data}
        onDataStateChange={onDataStateChange}
        supplierParties={supplierParties}
      />
    );
  }

  if (route.mode === "supplier-detail" || route.mode === "supplier-edit") {
    const supplierInvoice =
      data.supplierInvoices.find(
        (candidate) => candidate.id === route.supplierInvoiceId
      ) ?? null;

    if (!supplierInvoice) {
      return <SupplierInvoiceNotFound supplierInvoiceId={route.supplierInvoiceId} />;
    }

    return (
      <SupplierInvoiceDetailPage
        data={data}
        mode={route.mode === "supplier-edit" ? "edit" : "detail"}
        onDataStateChange={onDataStateChange}
        supplierInvoice={supplierInvoice}
        supplierParties={supplierParties}
      />
    );
  }

  return <SupplierInvoiceListPage data={data} />;
}

function SupplierInvoiceListPage({ data }: { data: ReadyAppData }) {
  return (
    <section className="panel" aria-labelledby="supplier-invoices-title">
      <div className="panel-header">
        <h2 id="supplier-invoices-title">Supplier invoices</h2>
        <div className="transaction-detail-actions">
          <Link className="secondary-button" to="/workspace/purchases/owner-transactions/new">
            Owner transaction
          </Link>
          <Link className="primary-button" to="/workspace/purchases/supplier-invoices/new">
            Receive invoice
          </Link>
        </div>
      </div>

      <div className="document-list" aria-label="Supplier invoices">
        {data.supplierInvoices.length === 0 ? (
          <p className="empty-state">No supplier invoices yet.</p>
        ) : null}
        {data.supplierInvoices.map((supplierInvoice) => {
          const party = data.parties.find((candidate) => candidate.id === supplierInvoice.partyId);

          return (
            <Link
              className="document-list-item"
              key={supplierInvoice.id}
              to="/workspace/purchases/supplier-invoices/$supplierInvoiceId"
              params={{ supplierInvoiceId: supplierInvoice.id }}
            >
              <strong>{supplierInvoice.number}</strong>
              <span>
                {party?.name ?? "Unknown supplier"} · {supplierInvoice.issueDate} ·{" "}
                {supplierInvoice.total} {supplierInvoice.currency} · {supplierInvoice.status}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function SupplierInvoiceDetailPage({
  data,
  mode,
  onDataStateChange,
  supplierInvoice,
  supplierParties
}: {
  data: ReadyAppData;
  mode: "detail" | "edit";
  onDataStateChange: (state: AppDataState) => void;
  supplierInvoice: SupplierInvoice;
  supplierParties: Party[];
}) {
  const navigate = useNavigate();
  const [selectedPaymentBankTransactionId, setSelectedPaymentBankTransactionId] = useState("");
  const [actionState, setActionState] = useState<
    "idle" | "updating" | "deleting" | "paying" | "undo"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editPartyId, setEditPartyId] = useState(supplierInvoice.partyId);
  const [editNumber, setEditNumber] = useState(supplierInvoice.number);
  const [editIssueDate, setEditIssueDate] = useState(supplierInvoice.issueDate);
  const [editTotal, setEditTotal] = useState(supplierInvoice.total);
  const [editExpenseAccountCode, setEditExpenseAccountCode] = useState(
    supplierInvoice.expenseAccountCode
  );
  const supplierParty =
    data.parties.find((party) => party.id === supplierInvoice.partyId) ?? null;
  const supplierInvoiceEntries = data.journalEntries.filter((entry) =>
    entry.lines.some((line) => line.supplierInvoiceId === supplierInvoice.id)
  );
  const linkedBankTransaction =
    data.bankTransactions.find(
      (bankTransaction) =>
        bankTransaction.matchedDocumentType === "supplier_invoice" &&
        bankTransaction.matchedDocumentId === supplierInvoice.id
    ) ?? null;
  const paymentCandidates = getOutgoingPaymentCandidates(data.bankTransactions, supplierInvoice);
  const selectedOutgoingBankTransactionId =
    selectedPaymentBankTransactionId || paymentCandidates[0]?.id || "";

  useEffect(() => {
    setEditPartyId(supplierInvoice.partyId);
    setEditNumber(supplierInvoice.number);
    setEditIssueDate(supplierInvoice.issueDate);
    setEditTotal(supplierInvoice.total);
    setEditExpenseAccountCode(supplierInvoice.expenseAccountCode);
  }, [supplierInvoice]);

  async function handleRecordPayment() {
    setActionState("paying");
    setErrorMessage(null);

    try {
      if (!selectedOutgoingBankTransactionId) {
        throw new Error("Select an outgoing bank transaction first.");
      }

      const overview = await matchSupplierPaymentFromBankTransaction(
        supplierInvoice.id,
        selectedOutgoingBankTransactionId
      );

      onDataStateChange({ ...data, ...mapOverviewToReadyState(overview) });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Supplier payment was not recorded."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleUndoPayment() {
    if (!linkedBankTransaction) return;

    setActionState("undo");
    setErrorMessage(null);

    try {
      const overview = await undoBankTransactionPosting(linkedBankTransaction.id);
      onDataStateChange({ ...data, ...mapOverviewToReadyState(overview) });
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
    setActionState("updating");
    setErrorMessage(null);

    try {
      const overview = await updateSupplierInvoice({
        supplierInvoiceId: supplierInvoice.id,
        partyId: editPartyId,
        number: editNumber,
        issueDate: editIssueDate,
        total: editTotal,
        expenseAccountCode: editExpenseAccountCode
      });

      onDataStateChange({ ...data, ...mapOverviewToReadyState(overview) });
      void navigate({
        to: "/workspace/purchases/supplier-invoices/$supplierInvoiceId",
        params: { supplierInvoiceId: supplierInvoice.id }
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Supplier invoice was not updated."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleDeleteSupplierInvoice() {
    setActionState("deleting");
    setErrorMessage(null);

    try {
      const overview = await deleteSupplierInvoice(supplierInvoice.id);
      onDataStateChange({ ...data, ...mapOverviewToReadyState(overview) });
      void navigate({ to: "/workspace/purchases/supplier-invoices" });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Supplier invoice was not deleted."
      );
    } finally {
      setActionState("idle");
    }
  }

  return (
    <section className="panel" aria-labelledby="supplier-invoice-detail-title">
      <div className="panel-header">
        <h2 id="supplier-invoice-detail-title">Supplier invoice {supplierInvoice.number}</h2>
        <span className="status-pill">{supplierInvoice.status}</span>
      </div>
      <div className="transaction-detail-actions">
        {mode === "edit" ? (
          <Link
            className="secondary-button"
            to="/workspace/purchases/supplier-invoices/$supplierInvoiceId"
            params={{ supplierInvoiceId: supplierInvoice.id }}
          >
            Cancel
          </Link>
        ) : null}
        {mode === "detail" && supplierInvoice.status !== "paid" ? (
          <Link
            className="secondary-button"
            to="/workspace/purchases/supplier-invoices/$supplierInvoiceId/edit"
            params={{ supplierInvoiceId: supplierInvoice.id }}
          >
            Edit invoice
          </Link>
        ) : null}
      </div>

      {mode === "edit" ? (
        <form className="invoice-form" onSubmit={(event) => void handleUpdateSupplierInvoice(event)}>
          <SupplierInvoiceEditableFields
            currency={supplierInvoice.currency}
            disabled={supplierInvoice.status === "paid"}
            expenseAccountCode={editExpenseAccountCode}
            issueDate={editIssueDate}
            number={editNumber}
            partyId={editPartyId}
            supplierParties={supplierParties}
            total={editTotal}
            onExpenseAccountCodeChange={setEditExpenseAccountCode}
            onIssueDateChange={setEditIssueDate}
            onNumberChange={setEditNumber}
            onPartyIdChange={setEditPartyId}
            onTotalChange={setEditTotal}
          />
          <div className="transaction-detail-actions">
            <button
              className="primary-button"
              type="submit"
              disabled={actionState !== "idle" || supplierInvoice.status === "paid"}
            >
              {actionState === "updating" ? "Saving invoice" : "Save invoice"}
            </button>
            <Link
              className="secondary-button"
              to="/workspace/purchases/supplier-invoices/$supplierInvoiceId"
              params={{ supplierInvoiceId: supplierInvoice.id }}
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
                <dt>Supplier invoice</dt>
                <dd>{supplierInvoice.number}</dd>
              </div>
              <div>
                <dt>Supplier</dt>
                <PartyInvoiceDetails party={supplierParty} fallbackLabel="Unknown supplier" />
              </div>
              <div>
                <dt>Issue date</dt>
                <dd>{supplierInvoice.issueDate}</dd>
              </div>
              <div>
                <dt>Expense account</dt>
                <dd className="code-cell">{supplierInvoice.expenseAccountCode}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>
                  {supplierInvoice.total} {supplierInvoice.currency}
                </dd>
              </div>
            </dl>
          </div>
          {supplierParty ? (
            <div className="transaction-detail-actions">
              <Link
                className="secondary-button"
                to="/workspace/counterparties/$partyId"
                params={{ partyId: supplierParty.id }}
              >
                Open supplier
              </Link>
            </div>
          ) : null}
          <LinkedJournalEntries entries={supplierInvoiceEntries} />
          {linkedBankTransaction ? (
            <LinkedBankTransactionSummary
              label="Linked outgoing bank transaction"
              bankTransaction={linkedBankTransaction}
              onUndo={() => void handleUndoPayment()}
              undoDisabled={actionState !== "idle"}
              undoLabel={actionState === "undo" ? "Undoing payment" : "Undo payment"}
            />
          ) : (
            <>
              <label className="inline-select">
                <span>Outgoing bank transaction</span>
                <select
                  value={selectedOutgoingBankTransactionId}
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
                disabled={actionState !== "idle" || supplierInvoice.status === "paid"}
                onClick={() => void handleRecordPayment()}
              >
                {supplierInvoice.status === "paid" ? "Payment recorded" : "Record payment"}
              </button>
            </>
          )}
          {supplierInvoice.status !== "paid" ? (
            <button
              className="secondary-button danger-button"
              type="button"
              disabled={actionState !== "idle"}
              onClick={() => void handleDeleteSupplierInvoice()}
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

function SupplierInvoiceNotFound({ supplierInvoiceId }: { supplierInvoiceId: string }) {
  return (
    <section className="panel" aria-labelledby="supplier-invoice-not-found-title">
      <div className="panel-header">
        <h2 id="supplier-invoice-not-found-title">Supplier invoice not found</h2>
        <Link className="secondary-button" to="/workspace/purchases/supplier-invoices">
          Back to list
        </Link>
      </div>
      <p className="empty-state">
        Supplier invoice "{supplierInvoiceId}" does not exist in this workspace.
      </p>
    </section>
  );
}

function getPurchaseRoute(pathname: string): PurchaseRoute {
  const [, workspace, purchases, area, entityId, mode] = pathname.split("/");

  if (workspace !== "workspace" || purchases !== "purchases") {
    return { mode: "supplier-list" };
  }

  if (area === "owner-transactions" && entityId === "new") {
    return { mode: "owner-create" };
  }

  if (area !== "supplier-invoices" || !entityId) {
    return { mode: "supplier-list" };
  }

  if (entityId === "new") {
    return { mode: "supplier-create" };
  }

  if (mode === "edit") {
    return { mode: "supplier-edit", supplierInvoiceId: entityId };
  }

  return { mode: "supplier-detail", supplierInvoiceId: entityId };
}

function getOutgoingPaymentCandidates(
  bankTransactions: BankTransaction[],
  supplierInvoice: SupplierInvoice
) {
  return bankTransactions
    .filter(
      (bankTransaction) =>
        bankTransaction.status === "unmatched" && bankTransaction.amount.startsWith("-")
    )
    .sort((left, right) => {
      const leftScore = getPaymentCandidateScore(left, supplierInvoice);
      const rightScore = getPaymentCandidateScore(right, supplierInvoice);

      return rightScore - leftScore;
    });
}

function getPaymentCandidateScore(
  bankTransaction: BankTransaction,
  supplierInvoice: SupplierInvoice
) {
  let score = 0;

  if (bankTransaction.partyId === supplierInvoice.partyId) {
    score += 2;
  }

  if (Number(bankTransaction.amount.replace("-", "")) === Number(supplierInvoice.total)) {
    score += 1;
  }

  return score;
}
