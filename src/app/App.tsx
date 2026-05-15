import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  Account,
  BankAccount,
  BankTransaction,
  Invoice,
  JournalEntry,
  Party,
  PartyRole,
  PartyType,
  SupplierInvoice,
  Workspace
} from "../domain";
import { buildInfo } from "../generated/build-info";
import type { AccountBalance } from "../services/balances";
import {
  createBankAccount,
  createBankTransaction,
  matchInvoicePaymentFromBankTransaction,
  matchSupplierPaymentFromBankTransaction,
  postBankFeeFromBankTransaction
} from "../services/bank-workflow";
import {
  createSalesInvoice
} from "../services/invoice-workflow";
import {
  recordOwnerContribution,
  recordOwnerWithdrawal
} from "../services/owner-transactions-workflow";
import { createParty } from "../services/party-workflow";
import {
  createSupplierInvoice
} from "../services/supplier-invoice-workflow";
import {
  loadWorkspaceOverview,
  type WorkspaceOverview
} from "../services/workspace-overview";
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
      bankAccounts: BankAccount[];
      bankTransactions: BankTransaction[];
      parties: Party[];
      invoices: Invoice[];
      invoice: Invoice | null;
      invoiceParty: Party | null;
      supplierInvoices: SupplierInvoice[];
      supplierInvoice: SupplierInvoice | null;
      supplierInvoiceParty: Party | null;
      journalEntries: JournalEntry[];
      balances: AccountBalance[];
      initializedWorkspace: boolean;
    }
  | {
      state: "error";
      message: string;
    };

const partyRoles: PartyRole[] = ["customer", "supplier", "tax_authority", "bank", "owner"];

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
          bankAccounts: overview.bankAccounts,
          bankTransactions: overview.bankTransactions,
          parties: overview.parties,
          invoices: overview.invoices,
          invoice: overview.latestInvoice,
          invoiceParty: overview.latestInvoiceParty,
          supplierInvoices: overview.supplierInvoices,
          supplierInvoice: overview.latestSupplierInvoice,
          supplierInvoiceParty: overview.latestSupplierInvoiceParty,
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
          <CounterpartiesPanel data={data} onDataStateChange={onDataStateChange} />
          <BankingPanel data={data} onDataStateChange={onDataStateChange} />
          <InvoiceWorkflowPanel data={data} onDataStateChange={onDataStateChange} />
          <SupplierInvoiceWorkflowPanel
            data={data}
            onDataStateChange={onDataStateChange}
          />
          <OwnerTransactionsPanel data={data} onDataStateChange={onDataStateChange} />
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
        bankAccounts: overview.bankAccounts,
        bankTransactions: overview.bankTransactions,
        parties: overview.parties,
        invoices: overview.invoices,
        invoice: overview.latestInvoice,
        invoiceParty: overview.latestInvoiceParty,
        supplierInvoices: overview.supplierInvoices,
        supplierInvoice: overview.latestSupplierInvoice,
        supplierInvoiceParty: overview.latestSupplierInvoiceParty,
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

function CounterpartiesPanel({
  data,
  onDataStateChange
}: {
  data: Extract<AppDataState, { state: "ready" }>;
  onDataStateChange: (state: AppDataState) => void;
}) {
  const [name, setName] = useState("ACME d.o.o.");
  const [type, setType] = useState<PartyType>("business");
  const [roles, setRoles] = useState<PartyRole[]>(["customer"]);
  const [countryCode, setCountryCode] = useState("SI");
  const [vatId, setVatId] = useState("");
  const [actionState, setActionState] = useState<"idle" | "saving">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCreateParty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionState("saving");
    setErrorMessage(null);

    try {
      const overview = await createParty({
        workspaceId: data.workspace.id,
        name,
        type,
        roles,
        countryCode,
        vatId
      });

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setName("");
      setVatId("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Party was not created.");
    } finally {
      setActionState("idle");
    }
  }

  function toggleRole(role: PartyRole) {
    setRoles((currentRoles) =>
      currentRoles.includes(role)
        ? currentRoles.filter((currentRole) => currentRole !== role)
        : [...currentRoles, role]
    );
  }

  return (
    <section className="panel panel-wide" aria-labelledby="counterparties-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Parties</p>
          <h2 id="counterparties-title">Counterparties</h2>
        </div>
        <span>{data.parties.length} parties</span>
      </div>

      <form className="invoice-form" onSubmit={(event) => void handleCreateParty(event)}>
        <div className="form-row">
          <label>
            <span>Name</span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            <span>Type</span>
            <select value={type} onChange={(event) => setType(event.target.value as PartyType)}>
              <option value="business">Business</option>
              <option value="person">Person</option>
              <option value="government">Government</option>
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            <span>Country</span>
            <input value={countryCode} onChange={(event) => setCountryCode(event.target.value)} />
          </label>
          <label>
            <span>VAT ID</span>
            <input value={vatId} onChange={(event) => setVatId(event.target.value)} />
          </label>
        </div>
        <div className="role-picker" aria-label="Party roles">
          {partyRoles.map((role) => (
            <label key={role}>
              <input
                type="checkbox"
                checked={roles.includes(role)}
                onChange={() => toggleRole(role)}
              />
              <span>{role}</span>
            </label>
          ))}
        </div>
        <button className="primary-button" type="submit" disabled={actionState !== "idle"}>
          {actionState === "saving" ? "Creating" : "Create counterparty"}
        </button>
      </form>

      <div className="party-list">
        {data.parties.length === 0 ? <p className="empty-state">No counterparties yet.</p> : null}
        {data.parties.map((party) => (
          <article className="party-row" key={party.id}>
            <div>
              <strong>{party.name}</strong>
              <span>
                {party.type} · {party.countryCode ?? "No country"}
                {party.vatId ? ` · ${party.vatId}` : ""}
              </span>
            </div>
            <div className="role-list">
              {party.roles.map((role) => (
                <span className="role-pill role-posting" key={`${party.id}-${role}`}>
                  {role}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </section>
  );
}

function BankingPanel({
  data,
  onDataStateChange
}: {
  data: Extract<AppDataState, { state: "ready" }>;
  onDataStateChange: (state: AppDataState) => void;
}) {
  const [accountName, setAccountName] = useState("NLB EUR");
  const [accountCode, setAccountCode] = useState("1100");
  const [iban, setIban] = useState("");
  const [transactionBankAccountId, setTransactionBankAccountId] = useState(
    data.bankAccounts[0]?.id ?? ""
  );
  const [bookingDate, setBookingDate] = useState("2026-05-15");
  const [transactionAmount, setTransactionAmount] = useState("1000.00");
  const [description, setDescription] = useState("Bank transaction");
  const [reference, setReference] = useState("");
  const [actionState, setActionState] = useState<
    "idle" | "account" | "transaction" | "fee"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedBankAccountId = transactionBankAccountId || data.bankAccounts[0]?.id || "";

  async function handleCreateBankAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionState("account");
    setErrorMessage(null);

    try {
      const overview = await createBankAccount({
        workspaceId: data.workspace.id,
        name: accountName,
        accountCode,
        currency: data.workspace.baseCurrency,
        iban
      });

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setTransactionBankAccountId(overview.bankAccounts.at(-1)?.id ?? "");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Bank account was not created."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleCreateBankTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionState("transaction");
    setErrorMessage(null);

    try {
      if (!selectedBankAccountId) {
        throw new Error("Create a bank account first.");
      }

      const overview = await createBankTransaction({
        workspaceId: data.workspace.id,
        bankAccountId: selectedBankAccountId,
        bookingDate,
        amount: transactionAmount,
        currency: data.workspace.baseCurrency,
        description,
        reference
      });

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Bank transaction was not created."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handlePostBankFee(bankTransactionId: string) {
    setActionState("fee");
    setErrorMessage(null);

    try {
      const overview = await postBankFeeFromBankTransaction(bankTransactionId);

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Bank fee was not posted.");
    } finally {
      setActionState("idle");
    }
  }

  return (
    <section className="panel panel-wide" aria-labelledby="banking-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Banking</p>
          <h2 id="banking-title">Bank accounts and transactions</h2>
        </div>
        <span>{data.bankTransactions.length} transactions</span>
      </div>

      <div className="banking-grid">
        <form className="invoice-form" onSubmit={(event) => void handleCreateBankAccount(event)}>
          <div className="form-row">
            <label>
              <span>Account name</span>
              <input value={accountName} onChange={(event) => setAccountName(event.target.value)} />
            </label>
            <label>
              <span>Account code</span>
              <select value={accountCode} onChange={(event) => setAccountCode(event.target.value)}>
                {data.accounts
                  .filter((account) => account.role === "posting" && account.code.startsWith("11"))
                  .map((account) => (
                    <option key={account.id} value={account.code}>
                      {account.code} · {account.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <label>
            <span>IBAN</span>
            <input value={iban} onChange={(event) => setIban(event.target.value)} />
          </label>
          <button className="primary-button" type="submit" disabled={actionState !== "idle"}>
            {actionState === "account" ? "Creating" : "Create bank account"}
          </button>
        </form>

        <form className="invoice-form" onSubmit={(event) => void handleCreateBankTransaction(event)}>
          <div className="form-row">
            <label>
              <span>Bank account</span>
              <select
                value={selectedBankAccountId}
                onChange={(event) => setTransactionBankAccountId(event.target.value)}
              >
                <option value="">Select bank account</option>
                {data.bankAccounts.map((bankAccount) => (
                  <option key={bankAccount.id} value={bankAccount.id}>
                    {bankAccount.name} · {bankAccount.accountCode}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Booking date</span>
              <input
                type="date"
                value={bookingDate}
                onChange={(event) => setBookingDate(event.target.value)}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              <span>Signed amount</span>
              <input
                value={transactionAmount}
                onChange={(event) => setTransactionAmount(event.target.value)}
              />
            </label>
            <label>
              <span>Reference</span>
              <input value={reference} onChange={(event) => setReference(event.target.value)} />
            </label>
          </div>
          <label>
            <span>Description</span>
            <input value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <button className="primary-button" type="submit" disabled={actionState !== "idle"}>
            {actionState === "transaction" ? "Creating" : "Create bank transaction"}
          </button>
        </form>
      </div>

      <div className="transaction-list">
        {data.bankTransactions.length === 0 ? (
          <p className="empty-state">No bank transactions yet.</p>
        ) : null}
        {data.bankTransactions.map((bankTransaction) => {
          const bankAccount = data.bankAccounts.find(
            (candidate) => candidate.id === bankTransaction.bankAccountId
          );
          const canPostFee =
            bankTransaction.status === "unmatched" && bankTransaction.amount.startsWith("-");

          return (
            <article className="transaction-row" key={bankTransaction.id}>
              <div>
                <strong>
                  {bankTransaction.amount} {bankTransaction.currency}
                </strong>
                <span>
                  {bankTransaction.bookingDate} · {bankAccount?.name ?? "Unknown account"} ·{" "}
                  {bankTransaction.status}
                </span>
                <small>{bankTransaction.description}</small>
              </div>
              {canPostFee ? (
                <button
                  className="secondary-button"
                  type="button"
                  disabled={actionState !== "idle"}
                  onClick={() => void handlePostBankFee(bankTransaction.id)}
                >
                  Post bank fee
                </button>
              ) : null}
            </article>
          );
        })}
      </div>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
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
  const customerParties = data.parties.filter(
    (party) => party.active && party.roles.includes("customer")
  );
  const [partyId, setPartyId] = useState(customerParties[0]?.id ?? "");
  const [number, setNumber] = useState("2026-0001");
  const [issueDate, setIssueDate] = useState("2026-05-10");
  const [total, setTotal] = useState("1000.00");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(data.invoice?.id ?? "");
  const [selectedPaymentBankTransactionId, setSelectedPaymentBankTransactionId] =
    useState("");
  const [actionState, setActionState] = useState<"idle" | "saving" | "paying">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedInvoice =
    data.invoices.find((invoice) => invoice.id === selectedInvoiceId) ??
    data.invoice ??
    null;
  const selectedInvoiceParty = selectedInvoice
    ? data.parties.find((party) => party.id === selectedInvoice.partyId) ?? null
    : null;
  const selectedInvoiceEntries = selectedInvoice
    ? data.journalEntries.filter((entry) =>
        entry.lines.some((line) => line.invoiceId === selectedInvoice.id)
      )
    : [];
  const incomingBankTransactions = data.bankTransactions.filter(
    (bankTransaction) =>
      bankTransaction.status === "unmatched" && !bankTransaction.amount.startsWith("-")
  );
  const selectedIncomingBankTransactionId =
    selectedPaymentBankTransactionId || incomingBankTransactions[0]?.id || "";

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

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedInvoiceId(overview.latestInvoice?.id ?? "");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Invoice was not created.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleRecordPayment() {
    if (!selectedInvoice) return;

    setActionState("paying");
    setErrorMessage(null);

    try {
      if (!selectedIncomingBankTransactionId) {
        throw new Error("Select an incoming bank transaction first.");
      }

      const overview = await matchInvoicePaymentFromBankTransaction(
        selectedInvoice.id,
        selectedIncomingBankTransactionId
      );

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedInvoiceId(overview.latestInvoice?.id ?? selectedInvoice.id);
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
        {selectedInvoice ? <span className="status-pill">{selectedInvoice.status}</span> : null}
      </div>

      <form className="invoice-form" onSubmit={(event) => void handleCreateInvoice(event)}>
        <label>
          <span>Customer</span>
          <select
            value={partyId}
            onChange={(event) => setPartyId(event.target.value)}
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

      <div className="document-split">
        <div className="document-list" aria-label="Issued invoices">
          {data.invoices.length === 0 ? (
            <p className="empty-state">No issued invoices yet.</p>
          ) : null}
          {data.invoices.map((invoice) => (
            <button
              className={`document-list-item ${
                selectedInvoice?.id === invoice.id ? "document-list-item-active" : ""
              }`}
              key={invoice.id}
              type="button"
              onClick={() => setSelectedInvoiceId(invoice.id)}
            >
              <strong>{invoice.number}</strong>
              <span>
                {invoice.total} {invoice.currency} · {invoice.status}
              </span>
            </button>
          ))}
        </div>

        {selectedInvoice ? (
        <div className="invoice-summary document-detail">
          <dl className="detail-list">
            <div>
              <dt>Selected invoice</dt>
              <dd>{selectedInvoice.number}</dd>
            </div>
            <div>
              <dt>Customer</dt>
              <dd>{selectedInvoiceParty?.name ?? "Unknown customer"}</dd>
            </div>
            <div>
              <dt>Issue date</dt>
              <dd>{selectedInvoice.issueDate}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>
                {selectedInvoice.total} {selectedInvoice.currency}
              </dd>
            </div>
          </dl>
          <LinkedJournalEntries entries={selectedInvoiceEntries} />
          <label className="inline-select">
            <span>Incoming bank transaction</span>
            <select
              value={selectedIncomingBankTransactionId}
              onChange={(event) => setSelectedPaymentBankTransactionId(event.target.value)}
            >
              <option value="">Select transaction</option>
              {incomingBankTransactions.map((bankTransaction) => (
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
            disabled={actionState !== "idle" || selectedInvoice.status === "paid"}
            onClick={() => void handleRecordPayment()}
          >
            {selectedInvoice.status === "paid" ? "Payment recorded" : "Record payment"}
          </button>
        </div>
        ) : null}
      </div>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </section>
  );
}

function SupplierInvoiceWorkflowPanel({
  data,
  onDataStateChange
}: {
  data: Extract<AppDataState, { state: "ready" }>;
  onDataStateChange: (state: AppDataState) => void;
}) {
  const supplierParties = data.parties.filter(
    (party) => party.active && party.roles.includes("supplier")
  );
  const [partyId, setPartyId] = useState(supplierParties[0]?.id ?? "");
  const [number, setNumber] = useState("SUP-2026-0001");
  const [issueDate, setIssueDate] = useState("2026-05-10");
  const [total, setTotal] = useState("40.00");
  const [selectedSupplierInvoiceId, setSelectedSupplierInvoiceId] = useState(
    data.supplierInvoice?.id ?? ""
  );
  const [
    selectedSupplierPaymentBankTransactionId,
    setSelectedSupplierPaymentBankTransactionId
  ] = useState("");
  const [actionState, setActionState] = useState<"idle" | "saving" | "paying">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedSupplierInvoice =
    data.supplierInvoices.find(
      (supplierInvoice) => supplierInvoice.id === selectedSupplierInvoiceId
    ) ??
    data.supplierInvoice ??
    null;
  const selectedSupplierInvoiceParty = selectedSupplierInvoice
    ? data.parties.find((party) => party.id === selectedSupplierInvoice.partyId) ?? null
    : null;
  const selectedSupplierInvoiceEntries = selectedSupplierInvoice
    ? data.journalEntries.filter((entry) =>
        entry.lines.some((line) => line.supplierInvoiceId === selectedSupplierInvoice.id)
      )
    : [];
  const outgoingBankTransactions = data.bankTransactions.filter(
    (bankTransaction) =>
      bankTransaction.status === "unmatched" && bankTransaction.amount.startsWith("-")
  );
  const selectedOutgoingBankTransactionId =
    selectedSupplierPaymentBankTransactionId || outgoingBankTransactions[0]?.id || "";

  async function handleCreateSupplierInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionState("saving");
    setErrorMessage(null);

    try {
      if (!partyId) {
        throw new Error("Select a supplier counterparty first.");
      }

      const overview = await createSupplierInvoice({
        workspaceId: data.workspace.id,
        partyId,
        number,
        issueDate,
        total,
        currency: data.workspace.baseCurrency
      });

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedSupplierInvoiceId(overview.latestSupplierInvoice?.id ?? "");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Supplier invoice was not created."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleRecordSupplierPayment() {
    if (!selectedSupplierInvoice) return;

    setActionState("paying");
    setErrorMessage(null);

    try {
      if (!selectedOutgoingBankTransactionId) {
        throw new Error("Select an outgoing bank transaction first.");
      }

      const overview = await matchSupplierPaymentFromBankTransaction(
        selectedSupplierInvoice.id,
        selectedOutgoingBankTransactionId
      );

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedSupplierInvoiceId(
        overview.latestSupplierInvoice?.id ?? selectedSupplierInvoice.id
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Supplier payment was not recorded."
      );
    } finally {
      setActionState("idle");
    }
  }

  return (
    <section className="panel" aria-labelledby="supplier-invoice-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Purchases</p>
          <h2 id="supplier-invoice-title">Supplier invoice</h2>
        </div>
        {selectedSupplierInvoice ? (
          <span className="status-pill">{selectedSupplierInvoice.status}</span>
        ) : null}
      </div>

      <form
        className="invoice-form"
        onSubmit={(event) => void handleCreateSupplierInvoice(event)}
      >
        <label>
          <span>Supplier</span>
          <select
            value={partyId}
            onChange={(event) => setPartyId(event.target.value)}
          >
            <option value="">Select supplier</option>
            {supplierParties.map((party) => (
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
          {actionState === "saving" ? "Receiving" : "Receive invoice"}
        </button>
      </form>

      <div className="document-split">
        <div className="document-list" aria-label="Supplier invoices">
          {data.supplierInvoices.length === 0 ? (
            <p className="empty-state">No supplier invoices yet.</p>
          ) : null}
          {data.supplierInvoices.map((supplierInvoice) => (
            <button
              className={`document-list-item ${
                selectedSupplierInvoice?.id === supplierInvoice.id
                  ? "document-list-item-active"
                  : ""
              }`}
              key={supplierInvoice.id}
              type="button"
              onClick={() => setSelectedSupplierInvoiceId(supplierInvoice.id)}
            >
              <strong>{supplierInvoice.number}</strong>
              <span>
                {supplierInvoice.total} {supplierInvoice.currency} ·{" "}
                {supplierInvoice.status}
              </span>
            </button>
          ))}
        </div>

        {selectedSupplierInvoice ? (
        <div className="invoice-summary document-detail">
          <dl className="detail-list">
            <div>
              <dt>Selected supplier invoice</dt>
              <dd>{selectedSupplierInvoice.number}</dd>
            </div>
            <div>
              <dt>Supplier</dt>
              <dd>{selectedSupplierInvoiceParty?.name ?? "Unknown supplier"}</dd>
            </div>
            <div>
              <dt>Issue date</dt>
              <dd>{selectedSupplierInvoice.issueDate}</dd>
            </div>
            <div>
              <dt>Expense account</dt>
              <dd className="code-cell">{selectedSupplierInvoice.expenseAccountCode}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>
                {selectedSupplierInvoice.total} {selectedSupplierInvoice.currency}
              </dd>
            </div>
          </dl>
          <LinkedJournalEntries entries={selectedSupplierInvoiceEntries} />
          <label className="inline-select">
            <span>Outgoing bank transaction</span>
            <select
              value={selectedOutgoingBankTransactionId}
              onChange={(event) =>
                setSelectedSupplierPaymentBankTransactionId(event.target.value)
              }
            >
              <option value="">Select transaction</option>
              {outgoingBankTransactions.map((bankTransaction) => (
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
            disabled={actionState !== "idle" || selectedSupplierInvoice.status === "paid"}
            onClick={() => void handleRecordSupplierPayment()}
          >
            {selectedSupplierInvoice.status === "paid"
              ? "Supplier payment recorded"
              : "Record supplier payment"}
          </button>
        </div>
        ) : null}
      </div>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </section>
  );
}

function OwnerTransactionsPanel({
  data,
  onDataStateChange
}: {
  data: Extract<AppDataState, { state: "ready" }>;
  onDataStateChange: (state: AppDataState) => void;
}) {
  const [entryDate, setEntryDate] = useState("2026-05-10");
  const [amount, setAmount] = useState("300.00");
  const [actionState, setActionState] = useState<
    "idle" | "contribution" | "withdrawal"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleOwnerTransaction(
    transactionType: "contribution" | "withdrawal"
  ) {
    setActionState(transactionType);
    setErrorMessage(null);

    try {
      const input = {
        workspaceId: data.workspace.id,
        entryDate,
        amount,
        currency: data.workspace.baseCurrency
      };
      const overview =
        transactionType === "contribution"
          ? await recordOwnerContribution(input)
          : await recordOwnerWithdrawal(input);

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Owner transaction was not recorded."
      );
    } finally {
      setActionState("idle");
    }
  }

  return (
    <section className="panel" aria-labelledby="owner-transactions-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Owner</p>
          <h2 id="owner-transactions-title">Owner transactions</h2>
        </div>
      </div>

      <div className="invoice-form">
        <div className="form-row">
          <label>
            <span>Date</span>
            <input
              required
              type="date"
              value={entryDate}
              onChange={(event) => setEntryDate(event.target.value)}
            />
          </label>
          <label>
            <span>Amount</span>
            <input
              required
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
        </div>
        <div className="button-row">
          <button
            className="primary-button"
            type="button"
            disabled={actionState !== "idle"}
            onClick={() => void handleOwnerTransaction("contribution")}
          >
            {actionState === "contribution" ? "Recording" : "Record contribution"}
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={actionState !== "idle"}
            onClick={() => void handleOwnerTransaction("withdrawal")}
          >
            {actionState === "withdrawal" ? "Recording" : "Record withdrawal"}
          </button>
        </div>
      </div>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </section>
  );
}

function LinkedJournalEntries({ entries }: { entries: JournalEntry[] }) {
  return (
    <div className="linked-entries">
      <strong>Linked journal entries</strong>
      {entries.length === 0 ? <p className="empty-state">No linked entries yet.</p> : null}
      {entries.map((entry) => (
        <div className="linked-entry" key={entry.id}>
          <span>{entry.description}</span>
          <small>
            {entry.entryDate} · {entry.lines.length} lines
          </small>
        </div>
      ))}
    </div>
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

function mapOverviewToReadyState(overview: WorkspaceOverview) {
  return {
    bankAccounts: overview.bankAccounts,
    bankTransactions: overview.bankTransactions,
    parties: overview.parties,
    invoices: overview.invoices,
    invoice: overview.latestInvoice,
    invoiceParty: overview.latestInvoiceParty,
    supplierInvoices: overview.supplierInvoices,
    supplierInvoice: overview.latestSupplierInvoice,
    supplierInvoiceParty: overview.latestSupplierInvoiceParty,
    journalEntries: overview.journalEntries,
    balances: overview.balances
  };
}
