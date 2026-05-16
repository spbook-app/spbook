import type { AppDataState } from "../../app/App";
import { BalancesTable } from "../../entities/account/BalancesTable";

export function DashboardView({
  data,
  accountNames
}: {
  data: Extract<AppDataState, { state: "ready" }>;
  accountNames: Map<string, string>;
}) {
  const unpaidInvoices = data.invoices.filter((invoice) => invoice.status !== "paid");
  const unpaidSupplierInvoices = data.supplierInvoices.filter(
    (supplierInvoice) => supplierInvoice.status !== "paid"
  );
  const unmatchedBankTransactions = data.bankTransactions.filter(
    (bankTransaction) => bankTransaction.status === "unmatched"
  );
  const recentJournalEntries = data.journalEntries.slice(-3).reverse();

  return (
    <div className="section-stack">
      <MetricStrip data={data} />
      <div className="dashboard-grid">
        <section className="panel" aria-labelledby="work-queue-title">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Focus</p>
              <h2 id="work-queue-title">Open work</h2>
            </div>
          </div>
          <div className="work-queue">
            <WorkQueueItem label="Unpaid issued invoices" value={unpaidInvoices.length} />
            <WorkQueueItem
              label="Unpaid supplier invoices"
              value={unpaidSupplierInvoices.length}
            />
            <WorkQueueItem
              label="Unmatched bank transactions"
              value={unmatchedBankTransactions.length}
            />
          </div>
        </section>

        <BalancesTable balances={data.balances.slice(0, 5)} accountNames={accountNames} />
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
            <article className="journal-entry" key={entry.id}>
              <header>
                <div>
                  <strong>{entry.description}</strong>
                  <span>
                    {entry.entryDate} · {entry.sourceType}
                  </span>
                </div>
                <code>{entry.lines.length} lines</code>
              </header>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function MetricStrip({ data }: { data: Extract<AppDataState, { state: "ready" }> }) {
  const postingAccounts = data.accounts.filter((account) => account.role === "posting");

  return (
    <dl className="metric-strip" aria-label="MVP summary">
      <div>
        <dt>Sales invoice</dt>
        <dd>{data.invoice?.number ?? "Not created"}</dd>
      </div>
      <div>
        <dt>Supplier invoice</dt>
        <dd>{data.supplierInvoice?.number ?? "Not received"}</dd>
      </div>
      <div>
        <dt>Posting accounts</dt>
        <dd>{postingAccounts.length}</dd>
      </div>
      <div>
        <dt>Journal entries</dt>
        <dd>{data.journalEntries.length}</dd>
      </div>
    </dl>
  );
}

function WorkQueueItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="work-queue-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
