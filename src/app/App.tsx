import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Account, Invoice, JournalEntry, Party, Workspace } from "../domain";
import { buildInfo } from "../generated/build-info";
import type { AccountBalance } from "../services/balances";
import {
  createSalesInvoice,
  loadWorkspaceOverview,
  recordInvoicePayment
} from "../services/invoice-workflow";
import { initializeDefaultWorkspace } from "../storage/initialize-workspace";
import { clearDatabase } from "../storage/repositories";
import { appMeta } from "./app-meta";
import {
  formatAppBuildLabel,
  getAppEnvironment,
  getAppEnvironmentLabel,
  shouldShowEnvironmentBadge
} from "./app-env";

type AppDataState =
  | {
      state: "loading";
    }
  | {
      state: "ready";
      workspace: Workspace;
      accounts: Account[];
      parties: Party[];
      invoice: Invoice | null;
      invoiceParty: Party | null;
      journalEntries: JournalEntry[];
      balances: AccountBalance[];
      initializedWorkspace: boolean;
    }
  | {
      state: "error";
      message: string;
    };

export function App() {
  const appEnvironment = getAppEnvironment();
  const [dataState, setDataState] = useState<AppDataState>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;

    initializeDefaultWorkspace()
      .then(async (initialization) => {
        const overview = await loadWorkspaceOverview(initialization.workspace.id);

        if (cancelled) return;

        setDataState({
          state: "ready",
          workspace: initialization.workspace,
          accounts: overview.accounts,
          parties: overview.parties,
          invoice: overview.latestInvoice,
          invoiceParty: overview.latestInvoiceParty,
          journalEntries: overview.journalEntries,
          balances: overview.balances,
          initializedWorkspace: initialization.created
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;

        setDataState({
          state: "error",
          message: error instanceof Error ? error.message : "Unknown app error"
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="app-root">
      <header className="topbar">
        <div>
          <span className="brand-mark">SB</span>
          <span className="brand-name">{appMeta.name}</span>
        </div>
        {shouldShowEnvironmentBadge(appEnvironment) ? (
          <span className="environment-badge">
            {getAppEnvironmentLabel(appEnvironment)} · {formatAppBuildLabel(buildInfo)}
          </span>
        ) : null}
      </header>

      {dataState.state === "loading" ? <LoadingView /> : null}
      {dataState.state === "error" ? <ErrorView message={dataState.message} /> : null}
      {dataState.state === "ready" ? (
        <WorkspaceView
          data={dataState}
          onDataStateChange={setDataState}
          showReset={shouldShowEnvironmentBadge(appEnvironment)}
        />
      ) : null}
    </main>
  );
}

function LoadingView() {
  return (
    <section className="state-panel" aria-live="polite">
      <p className="eyebrow">Loading</p>
      <h1>Initializing local workspace</h1>
      <p>Opening IndexedDB, checking workspace data, and preparing local records.</p>
    </section>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <section className="state-panel error-panel" role="alert">
      <p className="eyebrow">Error</p>
      <h1>Local workspace failed</h1>
      <p>{message}</p>
    </section>
  );
}

function WorkspaceView({
  data,
  onDataStateChange,
  showReset
}: {
  data: Extract<AppDataState, { state: "ready" }>;
  onDataStateChange: (state: AppDataState) => void;
  showReset: boolean;
}) {
  const accountNames = useMemo(
    () => new Map(data.accounts.map((account) => [account.code, account.name])),
    [data.accounts]
  );

  return (
    <div className="workspace-layout">
      <WorkspaceSidebar
        data={data}
        onDataStateChange={onDataStateChange}
        showReset={showReset}
      />
      <section className="workspace-main" aria-label="Workspace overview">
        <header className="page-heading">
          <p className="eyebrow">{appMeta.status}</p>
          <h1>{appMeta.tagline}</h1>
          <p>{appMeta.description}</p>
        </header>

        <MetricStrip data={data} />

        <div className="content-grid">
          <AccountsTable accounts={data.accounts} />
          <InvoiceWorkflowPanel data={data} onDataStateChange={onDataStateChange} />
          <JournalEntriesPanel entries={data.journalEntries} />
          <BalancesTable balances={data.balances} accountNames={accountNames} />
        </div>
      </section>
    </div>
  );
}

function WorkspaceSidebar({
  data,
  onDataStateChange,
  showReset
}: {
  data: Extract<AppDataState, { state: "ready" }>;
  onDataStateChange: (state: AppDataState) => void;
  showReset: boolean;
}) {
  const [resetState, setResetState] = useState<"idle" | "resetting">("idle");

  async function handleReset() {
    setResetState("resetting");

    try {
      await clearDatabase();
      const initialization = await initializeDefaultWorkspace();
      const overview = await loadWorkspaceOverview(initialization.workspace.id);

      onDataStateChange({
        state: "ready",
        workspace: initialization.workspace,
        accounts: overview.accounts,
        parties: overview.parties,
        invoice: overview.latestInvoice,
        invoiceParty: overview.latestInvoiceParty,
        journalEntries: overview.journalEntries,
        balances: overview.balances,
        initializedWorkspace: initialization.created
      });
    } catch (error) {
      onDataStateChange({
        state: "error",
        message: error instanceof Error ? error.message : "Unknown reset error"
      });
    } finally {
      setResetState("idle");
    }
  }

  return (
    <aside className="workspace-sidebar" aria-label="Workspace status">
      <div>
        <p className="eyebrow">Workspace</p>
        <h2>{data.workspace.name}</h2>
        <dl className="sidebar-details">
          <div>
            <dt>Country</dt>
            <dd>{data.workspace.countryCode}</dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>{data.workspace.baseCurrency}</dd>
          </div>
          <div>
            <dt>Storage</dt>
            <dd>{data.initializedWorkspace ? "Created locally" : "Loaded locally"}</dd>
          </div>
          <div>
            <dt>Accounts</dt>
            <dd>{data.accounts.length}</dd>
          </div>
        </dl>
      </div>
      <div className="sidebar-note">
        <strong>Offline-first</strong>
        <span>Data shown here is backed by IndexedDB in this browser.</span>
      </div>
      {showReset ? (
        <button
          className="secondary-button"
          type="button"
          disabled={resetState === "resetting"}
          onClick={() => void handleReset()}
        >
          {resetState === "resetting" ? "Resetting" : "Reset local data"}
        </button>
      ) : null}
    </aside>
  );
}

function MetricStrip({ data }: { data: Extract<AppDataState, { state: "ready" }> }) {
  const postingAccounts = data.accounts.filter((account) => account.role === "posting");

  return (
    <dl className="metric-strip" aria-label="MVP summary">
      <div>
        <dt>Invoice</dt>
        <dd>{data.invoice?.number ?? "Not created"}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>{data.invoice?.status ?? "ready"}</dd>
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

function AccountsTable({ accounts }: { accounts: Account[] }) {
  return (
    <section className="panel panel-wide" aria-labelledby="accounts-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Chart</p>
          <h2 id="accounts-title">Workspace accounts</h2>
        </div>
        <span>{accounts.length} accounts</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Role</th>
              <th>Currency</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td className="code-cell">{account.code}</td>
                <td>{account.name}</td>
                <td>
                  <span className={`role-pill role-${account.role}`}>{account.role}</span>
                </td>
                <td>{account.currency ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function InvoiceWorkflowPanel({
  data,
  onDataStateChange
}: {
  data: Extract<AppDataState, { state: "ready" }>;
  onDataStateChange: (state: AppDataState) => void;
}) {
  const [customerName, setCustomerName] = useState("Demo Customer d.o.o.");
  const [number, setNumber] = useState("2026-0001");
  const [issueDate, setIssueDate] = useState("2026-05-10");
  const [total, setTotal] = useState("1000.00");
  const [actionState, setActionState] = useState<"idle" | "saving" | "paying">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCreateInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionState("saving");
    setErrorMessage(null);

    try {
      const overview = await createSalesInvoice({
        workspaceId: data.workspace.id,
        customerName,
        number,
        issueDate,
        total,
        currency: data.workspace.baseCurrency
      });

      onDataStateChange({
        ...data,
        parties: overview.parties,
        invoice: overview.latestInvoice,
        invoiceParty: overview.latestInvoiceParty,
        journalEntries: overview.journalEntries,
        balances: overview.balances
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Invoice was not created.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleRecordPayment() {
    if (!data.invoice) return;

    setActionState("paying");
    setErrorMessage(null);

    try {
      const overview = await recordInvoicePayment(data.invoice.id);

      onDataStateChange({
        ...data,
        parties: overview.parties,
        invoice: overview.latestInvoice,
        invoiceParty: overview.latestInvoiceParty,
        journalEntries: overview.journalEntries,
        balances: overview.balances
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Payment was not recorded.");
    } finally {
      setActionState("idle");
    }
  }

  return (
    <section className="panel" aria-labelledby="invoice-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Sales</p>
          <h2 id="invoice-title">Create invoice</h2>
        </div>
        {data.invoice ? <span className="status-pill">{data.invoice.status}</span> : null}
      </div>

      <form className="invoice-form" onSubmit={(event) => void handleCreateInvoice(event)}>
        <label>
          <span>Customer</span>
          <input
            required
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
          />
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
          {actionState === "saving" ? "Creating" : "Create invoice"}
        </button>
      </form>

      {data.invoice ? (
        <div className="invoice-summary">
          <dl className="detail-list">
            <div>
              <dt>Latest invoice</dt>
              <dd>{data.invoice.number}</dd>
            </div>
            <div>
              <dt>Customer</dt>
              <dd>{data.invoiceParty?.name ?? "Unknown customer"}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>
                {data.invoice.total} {data.invoice.currency}
              </dd>
            </div>
          </dl>
          <button
            className="secondary-button"
            type="button"
            disabled={actionState !== "idle" || data.invoice.status === "paid"}
            onClick={() => void handleRecordPayment()}
          >
            {data.invoice.status === "paid" ? "Payment recorded" : "Record payment"}
          </button>
        </div>
      ) : null}

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </section>
  );
}

function JournalEntriesPanel({ entries }: { entries: JournalEntry[] }) {
  return (
    <section className="panel panel-wide" aria-labelledby="journal-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Accounting</p>
          <h2 id="journal-title">Journal entries</h2>
        </div>
        <span>{entries.length} entries</span>
      </div>
      <div className="journal-list">
        {entries.length === 0 ? <p className="empty-state">No journal entries yet.</p> : null}
        {entries.map((entry) => (
          <article className="journal-entry" key={entry.id}>
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
          </article>
        ))}
      </div>
    </section>
  );
}

function BalancesTable({
  balances,
  accountNames
}: {
  balances: AccountBalance[];
  accountNames: Map<string, string>;
}) {
  return (
    <section className="panel" aria-labelledby="balances-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Reports</p>
          <h2 id="balances-title">Raw account balances</h2>
        </div>
      </div>
      <div className="balance-list">
        {balances.length === 0 ? <p className="empty-state">No balances yet.</p> : null}
        {balances.map((balance) => (
          <div className="balance-row" key={`${balance.accountCode}:${balance.currency}`}>
            <div>
              <span className="code-cell">{balance.accountCode}</span>
              <small>{accountNames.get(balance.accountCode) ?? "Unknown account"}</small>
            </div>
            <strong>
              {balance.amount} {balance.currency}
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}
