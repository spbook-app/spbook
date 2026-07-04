import { Link } from "@tanstack/react-router";
import {
  isUnpaidSupplierInvoice,
  type Account,
  type Invoice,
  type SupplierInvoice
} from "../../domain";
import type { DashboardViewProps } from "../../shared/model/widget-props";
import { BalancesTable } from "../../entities/account/BalancesTable";
import { requiresBankTransactionAction } from "../banking/bank-transaction-display";

export function DashboardView(props: DashboardViewProps) {
  const {
    invoices,
    supplierInvoices,
    bankTransactions,
    journalEntries,
    accounts,
    balances,
    accountNames
  } = props;
  const unpaidInvoices = invoices.filter((invoice) => invoice.status === "issued");
  const unpaidSupplierInvoices = supplierInvoices.filter(isUnpaidSupplierInvoice);
  const unmatchedBankTransactions = bankTransactions.filter(requiresBankTransactionAction);
  const recentJournalEntries = journalEntries.slice(-3).reverse();
  const accountIds = new Map(accounts.map((account) => [account.code, account.id]));

  return (
    <div className="section-stack">
      <MetricStrip
        invoices={invoices}
        supplierInvoices={supplierInvoices}
        accounts={accounts}
        journalEntryCount={journalEntries.length}
      />
      <div className="dashboard-grid">
        <section className="panel" aria-labelledby="work-queue-title">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Focus</p>
              <h2 id="work-queue-title">Open work</h2>
            </div>
          </div>
          <div className="work-queue">
            <Link
              className="work-queue-item work-queue-item--link"
              to="/workspace/sales/invoices"
              search={{ status: "issued" }}
            >
              <span>Unpaid issued invoices</span>
              <strong>{unpaidInvoices.length}</strong>
            </Link>
            <Link
              className="work-queue-item work-queue-item--link"
              to="/workspace/purchases/supplier-invoices"
              search={{ status: "unpaid" }}
            >
              <span>Unpaid supplier invoices</span>
              <strong>{unpaidSupplierInvoices.length}</strong>
            </Link>
            <Link
              className="work-queue-item work-queue-item--link"
              to="/workspace/banking/transactions"
              search={{ processingState: "needs_action" }}
            >
              <span>Unmatched bank transactions</span>
              <strong>{unmatchedBankTransactions.length}</strong>
            </Link>
          </div>
        </section>

        <BalancesTable balances={balances.slice(0, 5)} accountNames={accountNames} accountIds={accountIds} />
      </div>

      <section className="panel panel-wide" aria-labelledby="recent-journal-title">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Recent</p>
            <h2 id="recent-journal-title">Latest journal entries</h2>
          </div>
          <span>{recentJournalEntries.length} shown</span>
        </div>
        <div className="journal-list">
          {recentJournalEntries.length === 0 ? (
            <p className="empty-state">No journal entries yet.</p>
          ) : null}
          {recentJournalEntries.map((entry) => (
            <Link
              className="journal-entry journal-entry--link"
              key={entry.id}
              to="/workspace/accounting/journal-entries/$journalEntryId"
              params={{ journalEntryId: entry.id }}
            >
              <header>
                <div>
                  <strong>{entry.description}</strong>
                  <span>
                    {entry.entryDate} · {entry.sourceType}
                  </span>
                </div>
                <code>{entry.lines.length} lines</code>
              </header>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

interface MetricStripProps {
  invoices: Invoice[];
  supplierInvoices: SupplierInvoice[];
  accounts: Account[];
  journalEntryCount: number;
}

function MetricStrip({
  invoices,
  supplierInvoices,
  accounts,
  journalEntryCount
}: MetricStripProps) {
  const postingAccounts = accounts.filter((account) => account.role === "posting");
  const latestInvoice = invoices.length > 0 ? invoices[invoices.length - 1] : null;
  const latestSupplierInvoice = supplierInvoices.length > 0 ? supplierInvoices[supplierInvoices.length - 1] : null;

  return (
    <div className="metric-strip" aria-label="MVP summary">
      <Link className="metric-strip-item" to="/workspace/sales/invoices">
        <span className="metric-label">Sales invoice</span>
        <strong className="metric-value">{latestInvoice?.number ?? "Not created"}</strong>
      </Link>
      <Link className="metric-strip-item" to="/workspace/purchases/supplier-invoices">
        <span className="metric-label">Supplier invoice</span>
        <strong className="metric-value">{latestSupplierInvoice?.number ?? "Not received"}</strong>
      </Link>
      <Link className="metric-strip-item" to="/workspace/accounting/chart">
        <span className="metric-label">Posting accounts</span>
        <strong className="metric-value">{postingAccounts.length}</strong>
      </Link>
      <Link className="metric-strip-item" to="/workspace/accounting/journal-entries">
        <span className="metric-label">Journal entries</span>
        <strong className="metric-value">{journalEntryCount}</strong>
      </Link>
    </div>
  );
}

