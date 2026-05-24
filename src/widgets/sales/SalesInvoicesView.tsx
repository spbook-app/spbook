import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import type { BankTransaction, Invoice, Party } from "../../domain";
import type { SalesInvoicesViewProps } from "../../shared/model/widget-props";
import { LinkedJournalEntries } from "../../entities/journal/LinkedJournalEntries";
import { PartyInvoiceDetails } from "../../entities/party/PartyInvoiceDetails";
import { InvoiceCreateForm } from "../../features/invoice-create/InvoiceCreateForm";
import { InvoiceDeleteButton } from "../../features/invoice-delete/InvoiceDeleteButton";
import { InvoiceEditForm } from "../../features/invoice-edit/InvoiceEditForm";
import { InvoiceIssueButton } from "../../features/invoice-issue/InvoiceIssueButton";
import { InvoicePaymentPanel } from "../../features/invoice-payment/InvoicePaymentPanel";
import { InvoiceUnissueButton } from "../../features/invoice-unissue/InvoiceUnissueButton";

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
  parties
}: {
  bankTransactions: BankTransaction[];
  customerParties: Party[];
  invoice: Invoice;
  journalEntries: SalesInvoicesViewProps["journalEntries"];
  mode: "detail" | "edit";
  parties: Party[];
}) {
  const invoiceParty = parties.find((party) => party.id === invoice.partyId) ?? null;
  const invoiceEntries = journalEntries.filter((entry) =>
    entry.lines.some((line) => line.invoiceId === invoice.id)
  );

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
        {mode === "detail" && invoice.status === "draft" ? (
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
        <InvoiceEditForm
          customerParties={customerParties}
          invoice={invoice}
        />
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
          <InvoiceIssueButton invoice={invoice} />
          <InvoiceUnissueButton invoice={invoice} />
          {invoice.status !== "draft" ? (
            <InvoicePaymentPanel
              bankTransactions={bankTransactions}
              invoice={invoice}
            />
          ) : null}
          <InvoiceDeleteButton invoice={invoice} />
        </>
      )}
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
