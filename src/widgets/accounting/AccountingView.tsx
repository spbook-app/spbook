import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { WorkspaceUpdateHandler } from "../../shared/model/workspace";
import type {
  Account,
  BankAccount,
  Invoice,
  JournalEntry,
  JournalLineSide,
  Party,
  SupplierInvoice
} from "../../domain";
import type {
  AccountingViewProps,
  JournalEntriesViewProps
} from "../../shared/model/widget-props";
import { addMinorUnits, compareMinorUnits, parseMoneyAmount } from "../../domain/money";
import { AccountCreateForm } from "../../features/account-create/AccountCreateForm";
import {
  updateWorkspaceAccount
} from "../../services/account-workflow";
import type { AccountBalance } from "../../services/balances";
import { updateJournalEntry } from "../../services/journal-workflow";

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
  const navigate = useNavigate();
  const postingAccounts = accounts.filter((a) => a.role === "posting");
  const [editDescription, setEditDescription] = useState(entry.description);
  const [editDate, setEditDate] = useState(entry.entryDate);
  const [editLines, setEditLines] = useState<JournalLineEdit[]>(() =>
    entry.lines.map((line) => ({ ...line }))
  );
  const [actionState, setActionState] = useState<"idle" | "saving">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setEditDescription(entry.description);
    setEditDate(entry.entryDate);
    setEditLines(entry.lines.map((line) => ({ ...line })));
  }, [entry]);

  function handleAddLine() {
    setEditLines((prev) => [
      ...prev,
      {
        side: "debit",
        accountCode: postingAccounts[0]?.code ?? "",
        amount: "0.00",
        currency: baseCurrency
      }
    ]);
  }

  function handleRemoveLine(index: number) {
    setEditLines((prev) => prev.filter((_, i) => i !== index));
  }

  function handleLineChange(index: number, patch: Partial<JournalLineEdit>) {
    setEditLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setActionState("saving");

    try {
      const update = await updateJournalEntry({
        journalEntryId: entry.id,
        description: editDescription,
        entryDate: editDate,
        lines: editLines
      });

      onWorkspaceUpdate(update);
      void navigate({
        to: "/workspace/accounting/journal-entries/$journalEntryId",
        params: { journalEntryId: entry.id }
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Journal entry was not saved.");
    } finally {
      setActionState("idle");
    }
  }

  const debitTotal = addMinorUnits(
    editLines
      .filter((l) => l.side === "debit")
      .map((l) => parseMoneyAmount(l.amount))
      .filter((r): r is { ok: true; minorUnits: bigint } => r.ok)
      .map((r) => r.minorUnits)
  );
  const creditTotal = addMinorUnits(
    editLines
      .filter((l) => l.side === "credit")
      .map((l) => parseMoneyAmount(l.amount))
      .filter((r): r is { ok: true; minorUnits: bigint } => r.ok)
      .map((r) => r.minorUnits)
  );
  const isBalanced = compareMinorUnits(debitTotal, creditTotal) === 0;

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
        <form className="invoice-form" onSubmit={(event) => void handleSave(event)}>
          <div className="form-row">
            <label>
              <span>Description</span>
              <input
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
              />
            </label>
            <label>
              <span>Entry date</span>
              <input
                type="date"
                value={editDate}
                onChange={(event) => setEditDate(event.target.value)}
              />
            </label>
          </div>
          <div className="je-lines-editor">
            {editLines.map((line, index) => (
              <div className="je-line-row" key={index}>
                <label className="je-line-side">
                  <span>Side</span>
                  <select
                    value={line.side}
                    onChange={(event) =>
                      handleLineChange(index, { side: event.target.value as JournalLineSide })
                    }
                  >
                    <option value="debit">Dr</option>
                    <option value="credit">Cr</option>
                  </select>
                </label>
                <label className="je-line-account">
                  <span>Account</span>
                  <select
                    value={line.accountCode}
                    onChange={(event) =>
                      handleLineChange(index, { accountCode: event.target.value })
                    }
                  >
                    {postingAccounts.map((account) => (
                      <option key={account.id} value={account.code}>
                        {account.code} · {account.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="je-line-amount">
                  <span>Amount</span>
                  <input
                    value={line.amount}
                    onChange={(event) =>
                      handleLineChange(index, { amount: event.target.value })
                    }
                  />
                </label>
                <label className="je-line-currency">
                  <span>Currency</span>
                  <input
                    value={line.currency}
                    onChange={(event) =>
                      handleLineChange(index, { currency: event.target.value })
                    }
                  />
                </label>
                <div className="je-line-remove">
                  <span> </span>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleRemoveLine(index)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button type="button" className="secondary-button" onClick={handleAddLine}>
              Add line
            </button>
          </div>
          <div className="je-balance-status">
            <span>
              Dr total: <strong>{formatMinorUnits(debitTotal)}</strong>
            </span>
            <span>
              Cr total: <strong>{formatMinorUnits(creditTotal)}</strong>
            </span>
            {isBalanced ? (
              <span className="je-balanced">Balanced</span>
            ) : (
              <span className="je-unbalanced">Not balanced</span>
            )}
          </div>
          {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
          <div className="transaction-detail-actions">
            <button
              className="primary-button"
              type="submit"
              disabled={actionState !== "idle" || !isBalanced}
            >
              {actionState === "saving" ? "Saving" : "Save entry"}
            </button>
            <Link
              className="secondary-button"
              to="/workspace/accounting/journal-entries/$journalEntryId"
              params={{ journalEntryId: entry.id }}
            >
              Cancel
            </Link>
          </div>
        </form>
      )}
    </section>
  );
}

type JournalLineEdit = {
  side: JournalLineSide;
  accountCode: string;
  amount: string;
  currency: string;
  partyId?: string;
  invoiceId?: string;
  supplierInvoiceId?: string;
  bankAccountId?: string;
  taxPeriod?: string;
};

function formatMinorUnits(minorUnits: bigint): string {
  const whole = minorUnits / 100n;
  const fraction = (minorUnits % 100n).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
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
  const navigate = useNavigate();
  const groupAccounts = accounts.filter(
    (candidate) => candidate.role === "group" && candidate.id !== account.id
  );
  const relatedBalances = balances.filter((balance) => balance.accountCode === account.code);
  const relatedEntries = journalEntries.filter((entry) =>
    entry.lines.some((line) => line.accountCode === account.code)
  );
  const [editName, setEditName] = useState(account.name);
  const [editParentCode, setEditParentCode] = useState(account.parentCode ?? "");
  const [editCurrency, setEditCurrency] = useState(account.currency ?? "");
  const [editActive, setEditActive] = useState(account.active);
  const [actionState, setActionState] = useState<"idle" | "updating">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setEditName(account.name);
    setEditParentCode(account.parentCode ?? "");
    setEditCurrency(account.currency ?? "");
    setEditActive(account.active);
  }, [account]);

  async function handleUpdateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setActionState("updating");

    try {
      const update = await updateWorkspaceAccount({
        accountId: account.id,
        name: editName,
        parentCode: account.role === "posting" ? editParentCode : undefined,
        currency: account.role === "posting" ? editCurrency : undefined,
        active: editActive
      });

      onWorkspaceUpdate(update);
      void navigate({
        to: "/workspace/accounting/chart/$accountId",
        params: { accountId: account.id }
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Account was not updated.");
    } finally {
      setActionState("idle");
    }
  }

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
        <form className="invoice-form" onSubmit={(event) => void handleUpdateAccount(event)}>
          <AccountEditFields
            account={account}
            active={editActive}
            currency={editCurrency}
            groupAccounts={groupAccounts}
            name={editName}
            parentCode={editParentCode}
            onActiveChange={setEditActive}
            onCurrencyChange={setEditCurrency}
            onNameChange={setEditName}
            onParentCodeChange={setEditParentCode}
          />
          <p className="field-note">
            Account code and role are fixed after creation because journal entries refer to
            account codes.
          </p>
          <div className="transaction-detail-actions">
            <button className="primary-button" type="submit" disabled={actionState !== "idle"}>
              {actionState === "updating" ? "Saving" : "Save account"}
            </button>
            <Link
              className="secondary-button"
              to="/workspace/accounting/chart/$accountId"
              params={{ accountId: account.id }}
            >
              Cancel
            </Link>
          </div>
        </form>
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
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </section>
  );
}

function AccountingLinks() {
  return null;
}

function AccountEditFields({
  account,
  active,
  currency,
  groupAccounts,
  name,
  parentCode,
  onActiveChange,
  onCurrencyChange,
  onNameChange,
  onParentCodeChange
}: {
  account: Account;
  active: boolean;
  currency: string;
  groupAccounts: Account[];
  name: string;
  parentCode: string;
  onActiveChange: (value: boolean) => void;
  onCurrencyChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onParentCodeChange: (value: string) => void;
}) {
  return (
    <>
      <div className="form-row">
        <label>
          <span>Code</span>
          <input disabled value={account.code} />
        </label>
        <label>
          <span>Role</span>
          <input disabled value={account.role} />
        </label>
      </div>
      <label>
        <span>Name</span>
        <input value={name} onChange={(event) => onNameChange(event.target.value)} />
      </label>
      <div className="form-row">
        <label>
          <span>Parent group</span>
          <select
            value={parentCode}
            disabled={account.role !== "posting"}
            onChange={(event) => onParentCodeChange(event.target.value)}
          >
            <option value="">No parent</option>
            {groupAccounts.map((groupAccount) => (
              <option key={groupAccount.id} value={groupAccount.code}>
                {groupAccount.code} · {groupAccount.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Currency</span>
          <input
            disabled={account.role !== "posting"}
            value={currency}
            onChange={(event) => onCurrencyChange(event.target.value)}
          />
        </label>
      </div>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={active}
          onChange={(event) => onActiveChange(event.target.checked)}
        />
        <span>Active account</span>
      </label>
    </>
  );
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
