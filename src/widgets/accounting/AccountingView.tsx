import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { AppDataState } from "../../app/App";
import type { Account, AccountRole, JournalEntry } from "../../domain";
import {
  createWorkspaceAccount,
  updateWorkspaceAccount
} from "../../services/account-workflow";
import type { AccountBalance } from "../../services/balances";
import { mapOverviewToReadyState } from "../../shared/lib/workspace-overview";

type ReadyAppData = Extract<AppDataState, { state: "ready" }>;
type AccountingRoute =
  | { mode: "journal-list" }
  | { mode: "journal-detail"; journalEntryId: string }
  | { mode: "chart-list" }
  | { mode: "account-create" }
  | { mode: "account-detail"; accountId: string }
  | { mode: "account-edit"; accountId: string };

export function ChartOfAccountsView({
  data,
  onDataStateChange
}: {
  data: ReadyAppData;
  onDataStateChange: (state: AppDataState) => void;
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname
  });
  const route = getAccountingRoute(pathname);

  if (route.mode === "account-create") {
    return <AccountCreatePage data={data} onDataStateChange={onDataStateChange} />;
  }

  if (route.mode === "account-detail" || route.mode === "account-edit") {
    const account = data.accounts.find((candidate) => candidate.id === route.accountId) ?? null;

    if (!account) {
      return <AccountNotFound accountId={route.accountId} />;
    }

    return (
      <AccountDetailPage
        account={account}
        data={data}
        mode={route.mode === "account-edit" ? "edit" : "detail"}
        onDataStateChange={onDataStateChange}
      />
    );
  }

  return <AccountListPage data={data} />;
}

export function JournalEntriesView({
  accountNames,
  data
}: {
  accountNames: Map<string, string>;
  data: ReadyAppData;
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname
  });
  const route = getAccountingRoute(pathname);

  if (route.mode === "journal-detail") {
    const journalEntry =
      data.journalEntries.find((candidate) => candidate.id === route.journalEntryId) ?? null;

    if (!journalEntry) {
      return <JournalEntryNotFound journalEntryId={route.journalEntryId} />;
    }

    return <JournalEntryDetailPage accountNames={accountNames} entry={journalEntry} />;
  }

  return <JournalEntryListPage entries={data.journalEntries} />;
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
  entry
}: {
  accountNames: Map<string, string>;
  entry: JournalEntry;
}) {
  return (
    <section className="panel panel-wide" aria-labelledby="journal-entry-detail-title">
      <div className="panel-header">
        <h2 id="journal-entry-detail-title">{entry.description}</h2>
        <Link className="secondary-button" to="/workspace/accounting/journal-entries">
          Back to journal
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
            {entry.sourceType}
            {entry.sourceId ? ` · ${entry.sourceId}` : ""}
          </dd>
        </div>
      </dl>
      <div className="journal-list">
        <article className="journal-entry">
          <ul>
            {entry.lines.map((line, index) => (
              <li key={`${entry.id}-detail-${index}`}>
                <span className="side">{line.side === "debit" ? "Dr" : "Cr"}</span>
                <span className="code-cell">{line.accountCode}</span>
                <span>{accountNames.get(line.accountCode) ?? "Unknown account"}</span>
                <span>
                  {line.amount} {line.currency}
                </span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}

function AccountListPage({ data }: { data: ReadyAppData }) {
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
            {data.accounts.map((account) => {
              const accountBalances = data.balances.filter(
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

function AccountCreatePage({
  data,
  onDataStateChange
}: {
  data: ReadyAppData;
  onDataStateChange: (state: AppDataState) => void;
}) {
  const navigate = useNavigate();
  const groupAccounts = data.accounts.filter((account) => account.role === "group");
  const [code, setCode] = useState("1101");
  const [name, setName] = useState("Second bank account");
  const [role, setRole] = useState<AccountRole>("posting");
  const [parentCode, setParentCode] = useState("11");
  const [currency, setCurrency] = useState(data.workspace.baseCurrency);
  const [actionState, setActionState] = useState<"idle" | "creating">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setActionState("creating");

    try {
      const overview = await createWorkspaceAccount({
        workspaceId: data.workspace.id,
        code,
        name,
        role,
        parentCode: role === "posting" ? parentCode : undefined,
        currency: role === "posting" ? currency : undefined
      });
      const createdAccount = overview.accounts.find((account) => account.code === code.trim());

      onDataStateChange({ ...data, ...mapOverviewToReadyState(overview) });

      if (createdAccount) {
        void navigate({
          to: "/workspace/accounting/chart/$accountId",
          params: { accountId: createdAccount.id }
        });
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Account was not created.");
    } finally {
      setActionState("idle");
    }
  }

  return (
    <section className="panel panel-wide" aria-labelledby="account-create-title">
      <div className="panel-header">
        <h2 id="account-create-title">Create account</h2>
        <Link className="secondary-button" to="/workspace/accounting/chart">
          Back to chart
        </Link>
      </div>
      <form className="invoice-form" onSubmit={(event) => void handleCreateAccount(event)}>
        <AccountCreateFields
          code={code}
          currency={currency}
          groupAccounts={groupAccounts}
          name={name}
          parentCode={parentCode}
          role={role}
          onCodeChange={setCode}
          onCurrencyChange={setCurrency}
          onNameChange={setName}
          onParentCodeChange={setParentCode}
          onRoleChange={setRole}
        />
        <button className="primary-button" type="submit" disabled={actionState !== "idle"}>
          {actionState === "creating" ? "Creating" : "Create account"}
        </button>
      </form>
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </section>
  );
}

function AccountDetailPage({
  account,
  data,
  mode,
  onDataStateChange
}: {
  account: Account;
  data: ReadyAppData;
  mode: "detail" | "edit";
  onDataStateChange: (state: AppDataState) => void;
}) {
  const navigate = useNavigate();
  const groupAccounts = data.accounts.filter(
    (candidate) => candidate.role === "group" && candidate.id !== account.id
  );
  const relatedBalances = data.balances.filter((balance) => balance.accountCode === account.code);
  const relatedEntries = data.journalEntries.filter((entry) =>
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
      const overview = await updateWorkspaceAccount({
        accountId: account.id,
        name: editName,
        parentCode: account.role === "posting" ? editParentCode : undefined,
        currency: account.role === "posting" ? editCurrency : undefined,
        active: editActive
      });

      onDataStateChange({ ...data, ...mapOverviewToReadyState(overview) });
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

function AccountCreateFields({
  code,
  currency,
  groupAccounts,
  name,
  parentCode,
  role,
  onCodeChange,
  onCurrencyChange,
  onNameChange,
  onParentCodeChange,
  onRoleChange
}: {
  code: string;
  currency: string;
  groupAccounts: Account[];
  name: string;
  parentCode: string;
  role: AccountRole;
  onCodeChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onParentCodeChange: (value: string) => void;
  onRoleChange: (value: AccountRole) => void;
}) {
  return (
    <>
      <div className="form-row">
        <label>
          <span>Code</span>
          <input value={code} onChange={(event) => onCodeChange(event.target.value)} />
        </label>
        <label>
          <span>Name</span>
          <input value={name} onChange={(event) => onNameChange(event.target.value)} />
        </label>
      </div>
      <div className="form-row">
        <label>
          <span>Role</span>
          <select value={role} onChange={(event) => onRoleChange(event.target.value as AccountRole)}>
            <option value="posting">Posting</option>
            <option value="group">Group</option>
          </select>
        </label>
        <label>
          <span>Parent group</span>
          <select
            value={parentCode}
            disabled={role !== "posting"}
            onChange={(event) => onParentCodeChange(event.target.value)}
          >
            <option value="">No parent</option>
            {groupAccounts.map((account) => (
              <option key={account.id} value={account.code}>
                {account.code} · {account.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        <span>Currency</span>
        <input
          disabled={role !== "posting"}
          value={currency}
          onChange={(event) => onCurrencyChange(event.target.value)}
        />
      </label>
    </>
  );
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

function getAccountingRoute(pathname: string): AccountingRoute {
  const [, workspace, accounting, area, entityId, mode] = pathname.split("/");

  if (workspace !== "workspace" || accounting !== "accounting") {
    return { mode: "journal-list" };
  }

  if (area === "chart") {
    if (!entityId) return { mode: "chart-list" };
    if (entityId === "new") return { mode: "account-create" };
    if (mode === "edit") return { mode: "account-edit", accountId: entityId };
    return { mode: "account-detail", accountId: entityId };
  }

  if (area === "journal-entries" && entityId) {
    return { mode: "journal-detail", journalEntryId: entityId };
  }

  return { mode: "journal-list" };
}
