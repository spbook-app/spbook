import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import type { BankTransaction, Party, SupplierInvoice } from "../../domain";
import type { PurchasesViewProps } from "../../shared/model/widget-props";
import { LinkedJournalEntries } from "../../entities/journal/LinkedJournalEntries";
import { PartyInvoiceDetails } from "../../entities/party/PartyInvoiceDetails";
import { SupplierInvoiceCreateForm } from "../../features/supplier-invoice-create/SupplierInvoiceCreateForm";
import { OwnerTransactionsPanel } from "../../features/owner-transaction/OwnerTransactionsPanel";
import { SupplierInvoiceDeleteButton } from "../../features/supplier-invoice-delete/SupplierInvoiceDeleteButton";
import { SupplierInvoiceEditForm } from "../../features/supplier-invoice-edit/SupplierInvoiceEditForm";
import { SupplierInvoicePaymentPanel } from "../../features/supplier-invoice-payment/SupplierInvoicePaymentPanel";

export type PurchaseRoute =
  | { mode: "supplier-list" }
  | { mode: "supplier-create" }
  | { mode: "supplier-detail"; supplierInvoiceId: string }
  | { mode: "supplier-edit"; supplierInvoiceId: string }
  | { mode: "owner-create" };

export function PurchasesView(props: PurchasesViewProps & { route: PurchaseRoute }) {
  const {
    workspace,
    supplierInvoices,
    parties,
    bankTransactions,
    journalEntries,
    route
  } = props;
  const supplierParties = useMemo(
    () => parties.filter((party) => party.active && party.roles.includes("supplier")),
    [parties]
  );

  if (route.mode === "owner-create") {
    return (
      <OwnerTransactionsPanel
        baseCurrency={workspace.baseCurrency}
        workspaceId={workspace.id}
      />
    );
  }

  if (route.mode === "supplier-create") {
    return (
      <SupplierInvoiceCreateForm
        baseCurrency={workspace.baseCurrency}
        supplierParties={supplierParties}
        workspaceId={workspace.id}
      />
    );
  }

  if (route.mode === "supplier-detail" || route.mode === "supplier-edit") {
    const supplierInvoice =
      supplierInvoices.find(
        (candidate) => candidate.id === route.supplierInvoiceId
      ) ?? null;

    if (!supplierInvoice) {
      return <SupplierInvoiceNotFound supplierInvoiceId={route.supplierInvoiceId} />;
    }

    return (
      <SupplierInvoiceDetailPage
        bankTransactions={bankTransactions}
        journalEntries={journalEntries}
        mode={route.mode === "supplier-edit" ? "edit" : "detail"}
        parties={parties}
        supplierInvoice={supplierInvoice}
        supplierParties={supplierParties}
      />
    );
  }

  return <SupplierInvoiceListPage parties={parties} supplierInvoices={supplierInvoices} />;
}

function SupplierInvoiceListPage({
  parties,
  supplierInvoices
}: {
  parties: Party[];
  supplierInvoices: SupplierInvoice[];
}) {
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
        {supplierInvoices.length === 0 ? (
          <p className="empty-state">No supplier invoices yet.</p>
        ) : null}
        {supplierInvoices.map((supplierInvoice) => {
          const party = parties.find((candidate) => candidate.id === supplierInvoice.partyId);

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
  bankTransactions,
  journalEntries,
  mode,
  parties,
  supplierInvoice,
  supplierParties
}: {
  bankTransactions: BankTransaction[];
  journalEntries: PurchasesViewProps["journalEntries"];
  mode: "detail" | "edit";
  parties: Party[];
  supplierInvoice: SupplierInvoice;
  supplierParties: Party[];
}) {
  const supplierParty =
    parties.find((party) => party.id === supplierInvoice.partyId) ?? null;
  const supplierInvoiceEntries = journalEntries.filter((entry) =>
    entry.lines.some((line) => line.supplierInvoiceId === supplierInvoice.id)
  );

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
        <SupplierInvoiceEditForm
          supplierInvoice={supplierInvoice}
          supplierParties={supplierParties}
        />
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
          <SupplierInvoicePaymentPanel
            bankTransactions={bankTransactions}
            supplierInvoice={supplierInvoice}
          />
          <SupplierInvoiceDeleteButton
            supplierInvoice={supplierInvoice}
          />
        </>
      )}
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
