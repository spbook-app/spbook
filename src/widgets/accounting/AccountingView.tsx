import { Link } from "@tanstack/react-router";
import type { WorkspaceUpdateHandler } from "../../shared/model/workspace";
import type {
  Account,
  BankAccount,
  Invoice,
  JournalEntry,
  Party,
  SupplierInvoice
} from "../../domain";
import type {
  AccountingViewProps,
  JournalEntriesViewProps
} from "../../shared/model/widget-props";
import { AccountCreateForm } from "../../features/account-create/AccountCreateForm";
import { AccountEditForm } from "../../features/account-edit/AccountEditForm";
import { JournalEntryEditForm } from "../../features/journal-entry-edit/JournalEntryEditForm";
import type { AccountBalance } from "../../services/balances";

export type AccountingRoute =
  | { mode: "journal-list" }
  | { mode: "journal-detail"; journalEntryId: string }
  | { mode: "journal-edit"; journalEntryId: string }
  | { mode: "chart-list" }
  | { mode: "account-create" }
  | { mode: "account-detail"; accountId: string }
  | { mode: "account-edit"; accountId: string };

export function ChartOfAccountsView(
  props: AccountingViewProps & {
    route: Extract<
      AccountingRoute,
      { mode: "chart-list" | "account-create" | "account-detail" | "account-edit" }
    >;
  }
) {
  const { workspace, accounts, journalEntries, balances, onWorkspaceUpdate, route } = props;

  if (route.mode === "account-create") {
    return (
      <AccountCreateForm
        accounts={accounts}
        baseCurrency={workspace.baseCurrency}
        onWorkspaceUpdate={onWorkspaceUpdate}
        workspaceId={workspace.id}
      />
    );
  }

  if (route.mode === "account-detail" || route.mode === "account-edit") {
    const account = accounts.find((candidate) => candidate.id === route.accountId) ?? null;

    if (!account) {
      return <AccountNotFound accountId={route.accountId} />;
    }

    return (
      <AccountDetailPage
        account={account}
        accounts={accounts}
        balances={balances}
        journalEntries={journalEntries}
        mode={route.mode === "account-edit" ? "edit" : "detail"}
        onWorkspaceUpdate={onWorkspaceUpdate}
      />
    );
  }

  return <AccountListPage accounts={accounts} balances={balances} />;
}

export function JournalEntriesView(
  props: JournalEntriesViewProps & {
    route: Extract<
      AccountingRoute,
      { mode: "journal-list" | "journal-detail" | "journal-edit" }
    >;
  }
) {
  const {
    workspace,
    accounts,
    journalEntries,
    accountNames,
    bankAccounts,
    invoices,
    onWorkspaceUpdate,
    parties,
    supplierInvoices,
    route
  } = props;

  if (route.mode === "journal-detail" || route.mode === "journal-edit") {
    const journalEntry =
      journalEntries.find((candidate) => candidate.id === route.journalEntryId) ?? null;

    if (!journalEntry) {
      return <JournalEntryNotFound journalEntryId={route.journalEntryId} />;
    }

    return (
      <JournalEntryDetailPage
        accountNames={accountNames}
        accounts={accounts}
        bankAccounts={bankAccounts}
        baseCurrency={workspace.baseCurrency}
        entry={journalEntry}
        invoices={invoices}
        mode={route.mode === "journal-edit" ? "edit" : "detail"}
        onWorkspaceUpdate={onWorkspaceUpdate}
        parties={parties}
        supplierInvoices={supplierInvoices}
      />
    );
  }

  return <JournalEntryListPage entries={journalEntries} />;
}

function JournalEntryListPage({ entries }: { entries: JournalEntry[] }) {
  return (
    <section className="panel panel-wide" aria-labelledby="journal-title">
      <div className="panel-header">
        <h2 id="journal-title">Journal entries</h2>
      </div>
      <div className="journal-list">
        {entries.length === 0 ? <p className="empty-state">No journal entries yet.</p> : null}
        {entries.map((entry) => (
          <Link
            className="journal-entry"
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
              <code>{entry.id}</code>
            </header>
            <ul>
              {entry.lines.map((line, index) => (
                <li key={`${entry.id}-${index}`}>
                  <span className="side">{line.side === "debit" ? "Dr" : "Cr"}</span>
                  <span className="code-cell">{line.accountCode}</span>
                  <span>
                    {line.amount} {line.currency}
                  </span>
                </li>
              ))}
            </ul>
          </Link>
        ))}
      </div>
    </section>
  );
}

function JournalEntryDetailPage({
  accountNames,
  accounts,
  bankAccounts,
  baseCurrency,
  entry,
  invoices,
  mode,
  onWorkspaceUpdate,
  parties,
  supplierInvoices
}: {
  accountNames: Map<string, string>;
  accounts: Account[];
  bankAccounts: BankAccount[];
  baseCurrency: string;
  entry: JournalEntry;
  invoices: Invoice[];
  mode: "detail" | "edit";
  onWorkspaceUpdate: WorkspaceUpdateHandler;
  parties: Party[];
  supplierInvoices: SupplierInvoice[];
}) {
  return (
    <section className="panel panel-wide">
      {mode === "detail" ? (
        <>
          <div className="transaction-detail-actions">
            <Link
              className="secondary-button"
              to="/workspace/accounting/journal-entries/$journalEntryId/edit"
              params={{ journalEntryId: entry.id }}
            >
              Edit entry
            </Link>
          </div>
          <dl className="detail-list copyable-details">
            <div>
              <dt>ID</dt>
              <dd>{entry.id}</dd>
            </div>
            <div>
              <dt>Entry date</dt>
              <dd>{entry.entryDate}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>
                <JournalEntrySourceLink entry={entry} />
              </dd>
            </div>
          </dl>
          <div className="journal-list">
            <article className="journal-entry">
              <ul>
                {entry.lines.map((line, index) => {
                  const account =
                    accounts.find((a) => a.code === line.accountCode) ?? null;
                  const party =
                    line.partyId != null
                      ? (parties.find((p) => p.id === line.partyId) ?? null)
                      : null;
                  const invoice =
                    line.invoiceId != null
                      ? (invoices.find((inv) => inv.id === line.invoiceId) ?? null)
                      : null;
                  const supplierInvoice =
                    line.supplierInvoiceId != null
                      ? (supplierInvoices.find(
                          (si) => si.id === line.supplierInvoiceId
                        ) ?? null)
                      : null;
                  const bankAccount =
                    line.bankAccountId != null
                      ? (bankAccounts.find((ba) => ba.id === line.bankAccountId) ?? null)
                      : null;
                  const hasAnalytics = party || invoice || supplierInvoice || bankAccount;

                  return (
                    <li key={`${entry.id}-detail-${index}`}>
                      <span className="side">{line.side === "debit" ? "Dr" : "Cr"}</span>
                      <span className="code-cell">{line.accountCode}</span>
                      <div className="line-detail">
                        <div className="line-main">
                          {account ? (
                            <Link
                              to="/workspace/accounting/chart/$accountId"
                              params={{ accountId: account.id }}
                            >
                              {accountNames.get(line.accountCode) ?? "Unknown account"}
                            </Link>
                          ) : (
                            <span>
                              {accountNames.get(line.accountCode) ?? "Unknown account"}
                            </span>
                          )}
                          <span>
                            {line.amount} {line.currency}
                          </span>
                        </div>
                        {hasAnalytics ? (
                          <div className="line-analytics">
                            {party ? (
                              <Link
                                to="/workspace/counterparties/$partyId"
                                params={{ partyId: line.partyId! }}
                              >
                                {party.name}
                              </Link>
                            ) : null}
                            {invoice ? (
                              <Link
                                to="/workspace/sales/invoices/$invoiceId"
                                params={{ invoiceId: line.invoiceId! }}
                              >
                                Invoice {invoice.number}
                              </Link>
                            ) : null}
                            {supplierInvoice ? (
                              <Link
                                to="/workspace/purchases/supplier-invoices/$supplierInvoiceId"
                                params={{ supplierInvoiceId: line.supplierInvoiceId! }}
                              >
                                Supplier invoice {supplierInvoice.number}
                              </Link>
                            ) : null}
                            {bankAccount ? (
                              <Link
                                to="/workspace/banking/accounts/$bankAccountId"
                                params={{ bankAccountId: line.bankAccountId! }}
                              >
                                {bankAccount.name}
                              </Link>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </article>
          </div>
        </>
      ) : (
        <JournalEntryEditForm
          entry={entry}
          accounts={accounts}
          baseCurrency={baseCurrency}
          onWorkspaceUpdate={onWorkspaceUpdate}
        />
      )}
    </section>
  );
}

function JournalEntrySourceLink({ entry }: { entry: JournalEntry }) {
  if (!entry.sourceId) {
    return <span>{entry.sourceType}</span>;
  }
  if (entry.sourceType === "invoice") {
    return (
      <Link
        to="/workspace/sales/invoices/$invoiceId"
        params={{ invoiceId: entry.sourceId }}
      >
        {entry.sourceType} · {entry.sourceId}
      </Link>
    );
  }
  if (entry.sourceType === "supplier_invoice") {
    return (
      <Link
        to="/workspace/purchases/supplier-invoices/$supplierInvoiceId"
        params={{ supplierInvoiceId: entry.sourceId }}
      >
        {entry.sourceType} · {entry.sourceId}
      </Link>
    );
  }
  if (entry.sourceType === "bank_transaction") {
    return (
      <Link
        to="/workspace/banking/transactions/$bankTransactionId"
        params={{ bankTransactionId: entry.sourceId }}
      >
        {entry.sourceType} · {entry.sourceId}
      </Link>
    );
  }
  return (
    <span>
      {entry.sourceType} · {entry.sourceId}
    </span>
  );
}

function AccountListPage({
  accounts,
  balances
}: {
  accounts: Account[];
  balances: AccountBalance[];
}) {
  return (
    <section className="panel panel-wide" aria-labelledby="accounts-title">
      <div className="panel-header">
        <h2 id="accounts-title">Chart of accounts</h2>
        <Link className="primary-button" to="/workspace/accounting/chart/new">
          Create account
        </Link>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Role</th>
              <th>Currency</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => {
              const accountBalances = balances.filter(
                (b) => b.accountCode === account.code
              );
              const balanceLabel =
                accountBalances.length > 0
                  ? accountBalances.map((b) => `${b.amount} ${b.currency}`).join(" · ")
                  : "—";

              return (
                <tr key={account.id}>
                  <td className="code-cell">
                    <Link
                      to="/workspace/accounting/chart/$accountId"
                      params={{ accountId: account.id }}
                    >
                      {account.code}
                    </Link>
                  </td>
                  <td>{account.name}</td>
                  <td>
                    <span className={`role-pill role-${account.role}`}>{account.role}</span>
                  </td>
                  <td>{account.currency ?? "-"}</td>
                  <td className="balance-cell">{balanceLabel}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AccountDetailPage({
  account,
  accounts,
  balances,
  journalEntries,
  mode,
  onWorkspaceUpdate
}: {
  account: Account;
  accounts: Account[];
  balances: AccountBalance[];
  journalEntries: JournalEntry[];
  mode: "detail" | "edit";
  onWorkspaceUpdate: WorkspaceUpdateHandler;
}) {
  const relatedBalances = balances.filter((balance) => balance.accountCode === account.code);
  const relatedEntries = journalEntries.filter((entry) =>
    entry.lines.some((line) => line.accountCode === account.code)
  );

  return (
    <section className="panel panel-wide" aria-labelledby="account-detail-title">
      <div className="panel-header">
        <h2 id="account-detail-title">
          {account.code} · {account.name}
        </h2>
        <span className="status-pill">{account.active ? "active" : "inactive"}</span>
      </div>
      <div className="transaction-detail-actions">
        <Link className="secondary-button" to="/workspace/accounting/chart">
          Back to chart
        </Link>
        {mode === "detail" ? (
          <Link
            className="secondary-button"
            to="/workspace/accounting/chart/$accountId/edit"
            params={{ accountId: account.id }}
          >
            Edit account
          </Link>
        ) : null}
      </div>

      {mode === "edit" ? (
        <AccountEditForm account={account} accounts={accounts} onWorkspaceUpdate={onWorkspaceUpdate} />
      ) : (
        <>
          <dl className="detail-list copyable-details">
            <div>
              <dt>Code</dt>
              <dd>{account.code}</dd>
            </div>
            <div>
              <dt>Name</dt>
              <dd>{account.name}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{account.role}</dd>
            </div>
            <div>
              <dt>Parent code</dt>
              <dd>{account.parentCode ?? "-"}</dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>{account.currency ?? "-"}</dd>
            </div>
          </dl>
          <RelatedAccountBalances balances={relatedBalances} />
          <RelatedJournalEntries entries={relatedEntries} />
        </>
      )}
    </section>
  );
}

function AccountingLinks() {
  return null;
}

function RelatedAccountBalances({ balances }: { balances: AccountBalance[] }) {
  return (
    <div className="linked-entries">
      <strong>Balances</strong>
      {balances.length === 0 ? <p className="empty-state">No balance yet.</p> : null}
      {balances.map((balance) => (
        <div className="linked-entry" key={`${balance.accountCode}:${balance.currency}`}>
          <span>{balance.accountCode}</span>
          <small>
            {balance.amount} {balance.currency}
          </small>
        </div>
      ))}
    </div>
  );
}

function RelatedJournalEntries({ entries }: { entries: JournalEntry[] }) {
  return (
    <div className="linked-entries">
      <strong>Journal entries</strong>
      {entries.length === 0 ? <p className="empty-state">No journal entries yet.</p> : null}
      {entries.map((entry) => (
        <Link
          className="linked-entry"
          key={entry.id}
          to="/workspace/accounting/journal-entries/$journalEntryId"
          params={{ journalEntryId: entry.id }}
        >
          <span>{entry.description}</span>
          <small>
            {entry.entryDate} · {entry.lines.length} lines
          </small>
        </Link>
      ))}
    </div>
  );
}

function AccountNotFound({ accountId }: { accountId: string }) {
  return (
    <section className="panel" aria-labelledby="account-not-found-title">
      <div className="panel-header">
        <h2 id="account-not-found-title">Account not found</h2>
        <Link className="secondary-button" to="/workspace/accounting/chart">
          Back to chart
        </Link>
      </div>
      <p className="empty-state">Account "{accountId}" does not exist in this workspace.</p>
    </section>
  );
}

function JournalEntryNotFound({ journalEntryId }: { journalEntryId: string }) {
  return (
    <section className="panel" aria-labelledby="journal-entry-not-found-title">
      <div className="panel-header">
        <h2 id="journal-entry-not-found-title">Journal entry not found</h2>
        <Link className="secondary-button" to="/workspace/accounting/journal-entries">
          Back to journal
        </Link>
      </div>
      <p className="empty-state">
        Journal entry "{journalEntryId}" does not exist in this workspace.
      </p>
    </section>
  );
}
