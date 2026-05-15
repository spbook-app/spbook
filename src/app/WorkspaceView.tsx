import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import type { Account, BankTransaction, JournalEntry, PartyRole, PartyType } from "../domain";
import { buildInfo } from "../generated/build-info";
import type { AccountBalance } from "../services/balances";
import {
  createBankAccount,
  createBankTransaction,
  isValidIban,
  matchInvoicePaymentFromBankTransaction,
  matchSupplierPaymentFromBankTransaction,
  postBankFeeFromBankTransaction,
  updateBankAccount,
  updateBankTransaction
} from "../services/bank-workflow";
import { importCamt053BankTransactions } from "../services/camt053-import";
import { createSalesInvoice } from "../services/invoice-workflow";
import {
  recordOwnerContribution,
  recordOwnerWithdrawal
} from "../services/owner-transactions-workflow";
import { createParty, updateParty } from "../services/party-workflow";
import { createSupplierInvoice } from "../services/supplier-invoice-workflow";
import {
  loadWorkspaceOverview,
  type WorkspaceOverview
} from "../services/workspace-overview";
import { initializeDefaultWorkspace } from "../storage/initialize-workspace";
import { clearDatabase } from "../storage/repositories";
import { appMeta } from "./app-meta";
import { formatAppBuildLabel } from "./app-env";
import type { AppDataState } from "./App";

const partyRoles: PartyRole[] = ["customer", "supplier", "tax_authority", "bank", "owner"];
type WorkspaceSection =
  | "dashboard"
  | "sales"
  | "purchases"
  | "banking"
  | "counterparties"
  | "accounting"
  | "settings";

const workspaceSections: Array<{
  id: WorkspaceSection;
  label: string;
  description: string;
}> = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Workspace health and open work"
  },
  {
    id: "sales",
    label: "Sales",
    description: "Issued invoices and receipts"
  },
  {
    id: "purchases",
    label: "Purchases",
    description: "Supplier invoices and payments"
  },
  {
    id: "banking",
    label: "Banking",
    description: "Bank accounts and transactions"
  },
  {
    id: "counterparties",
    label: "Counterparties",
    description: "Customers, suppliers, banks, owner"
  },
  {
    id: "accounting",
    label: "Accounting",
    description: "Journal entries, balances, accounts"
  },
  {
    id: "settings",
    label: "Settings",
    description: "Local workspace controls"
  }
];

export function WorkspaceView({
  data,
  onDataStateChange,
  showReset
}: {
  data: Extract<AppDataState, { state: "ready" }>;
  onDataStateChange: (state: AppDataState) => void;
  showReset: boolean;
}) {
  const [activeSection, setActiveSection] = useState<WorkspaceSection>("dashboard");
  const accountNames = useMemo(
    () => new Map(data.accounts.map((account) => [account.code, account.name])),
    [data.accounts]
  );
  const activeSectionMeta =
    workspaceSections.find((section) => section.id === activeSection) ??
    workspaceSections[0]!;

  return (
    <div className="workspace-layout">
      <WorkspaceSidebar
        activeSection={activeSection}
        data={data}
        onDataStateChange={onDataStateChange}
        onSectionChange={setActiveSection}
      />
      <section className="workspace-main" aria-label={activeSectionMeta.label}>
        <header className="page-heading">
          <p className="eyebrow">{activeSectionMeta.label}</p>
          <h1>{activeSectionMeta.description}</h1>
          <p>{getSectionLead(activeSection)}</p>
        </header>

        {activeSection === "dashboard" ? <DashboardView data={data} accountNames={accountNames} /> : null}
        {activeSection === "sales" ? (
          <div className="section-stack">
            <InvoiceWorkflowPanel data={data} onDataStateChange={onDataStateChange} />
          </div>
        ) : null}
        {activeSection === "purchases" ? (
          <div className="section-stack">
            <SupplierInvoiceWorkflowPanel
              data={data}
              onDataStateChange={onDataStateChange}
            />
            <OwnerTransactionsPanel data={data} onDataStateChange={onDataStateChange} />
          </div>
        ) : null}
        {activeSection === "banking" ? (
          <div className="section-stack">
            <BankingPanel data={data} onDataStateChange={onDataStateChange} />
          </div>
        ) : null}
        {activeSection === "counterparties" ? (
          <div className="section-stack">
            <CounterpartiesPanel data={data} onDataStateChange={onDataStateChange} />
          </div>
        ) : null}
        {activeSection === "accounting" ? (
          <div className="section-stack">
            <BalancesTable balances={data.balances} accountNames={accountNames} />
            <JournalEntriesPanel entries={data.journalEntries} />
            <AccountsTable accounts={data.accounts} />
          </div>
        ) : null}
        {activeSection === "settings" ? (
          <SettingsPanel
            data={data}
            onDataStateChange={onDataStateChange}
            showReset={showReset}
          />
        ) : null}
      </section>
    </div>
  );
}

function WorkspaceSidebar({
  activeSection,
  data,
  onDataStateChange,
  onSectionChange
}: {
  activeSection: WorkspaceSection;
  data: Extract<AppDataState, { state: "ready" }>;
  onDataStateChange: (state: AppDataState) => void;
  onSectionChange: (section: WorkspaceSection) => void;
}) {
  const openItems =
    data.invoices.filter((invoice) => invoice.status !== "paid").length +
    data.supplierInvoices.filter((supplierInvoice) => supplierInvoice.status !== "paid").length +
    data.bankTransactions.filter((bankTransaction) => bankTransaction.status === "unmatched").length;

  return (
    <aside className="workspace-sidebar" aria-label="Workspace navigation">
      <div>
        <p className="eyebrow">Workspace</p>
        <h2>{data.workspace.name}</h2>
        <dl className="sidebar-details compact-sidebar-details">
          <div>
            <dt>Currency</dt>
            <dd>{data.workspace.baseCurrency}</dd>
          </div>
          <div>
            <dt>Open work</dt>
            <dd>{openItems}</dd>
          </div>
        </dl>
      </div>

      <nav className="sidebar-nav" aria-label="Workspace sections">
        {workspaceSections.map((section) => (
          <button
            className={`nav-item ${activeSection === section.id ? "nav-item-active" : ""}`}
            key={section.id}
            type="button"
            onClick={() => onSectionChange(section.id)}
          >
            <span>{section.label}</span>
            <small>{section.description}</small>
          </button>
        ))}
      </nav>

      <WorkspaceStatusCard
        data={data}
        onDataStateChange={onDataStateChange}
        showReset={false}
      />
    </aside>
  );
}

function WorkspaceStatusCard({
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
    <div className="sidebar-status-card">
      <dl className="sidebar-details">
        <div>
          <dt>Country</dt>
          <dd>{data.workspace.countryCode}</dd>
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
      <div className="sidebar-note compact-note">
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

function getSectionLead(section: WorkspaceSection) {
  switch (section) {
    case "dashboard":
      return appMeta.description;
    case "sales":
      return "Create issued invoices, review invoice status, and match incoming bank transactions.";
    case "purchases":
      return "Record supplier invoices, owner transactions, and outgoing payments.";
    case "banking":
      return "Maintain bank accounts, add signed bank transactions, and post bank fees.";
    case "counterparties":
      return "Keep customers, suppliers, banks, owner, and tax authority records in one place.";
    case "accounting":
      return "Inspect balances, journal entries, and the seeded chart of accounts.";
    case "settings":
      return "Review local workspace status and development-only controls.";
  }
}

function DashboardView({
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

function WorkQueueItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="work-queue-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PartyInvoiceDetails({
  party,
  fallbackLabel
}: {
  party: Extract<AppDataState, { state: "ready" }>["parties"][number] | null;
  fallbackLabel: string;
}) {
  if (!party) {
    return <dd>{fallbackLabel}</dd>;
  }

  const locality = [party.postalCode, party.city].filter(Boolean).join(" ");
  const address = [
    party.addressLine1,
    party.addressLine2,
    locality || undefined,
    party.countryCode
  ].filter(Boolean);
  const contact = [party.contactName, party.email].filter(Boolean).join(" · ");

  return (
    <dd className="party-detail">
      <strong>{party.name}</strong>
      {party.vatId ? <span>{party.vatId}</span> : null}
      {address.length > 0 ? <span>{address.join(", ")}</span> : null}
      {contact ? <span>{contact}</span> : null}
    </dd>
  );
}

function getIbanValidationMessage(iban: string) {
  const normalized = iban.replace(/\s+/g, "").toUpperCase();

  if (!normalized) {
    return null;
  }

  if (!isValidIban(normalized)) {
    return "Enter a valid IBAN, for example SI56 1910 0000 0123 438.";
  }

  return null;
}

function SettingsPanel({
  data,
  onDataStateChange,
  showReset
}: {
  data: Extract<AppDataState, { state: "ready" }>;
  onDataStateChange: (state: AppDataState) => void;
  showReset: boolean;
}) {
  return (
    <section className="panel" aria-labelledby="settings-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Local</p>
          <h2 id="settings-title">Workspace settings</h2>
        </div>
      </div>
      <dl className="detail-list settings-details">
        <div>
          <dt>Workspace</dt>
          <dd>{data.workspace.name}</dd>
        </div>
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
          <dt>Build</dt>
          <dd>{formatAppBuildLabel(buildInfo)}</dd>
        </div>
      </dl>
      {showReset ? (
        <WorkspaceStatusCard
          data={data}
          onDataStateChange={onDataStateChange}
          showReset={showReset}
        />
      ) : null}
    </section>
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
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedEditPartyId, setSelectedEditPartyId] = useState(data.parties[0]?.id ?? "");
  const selectedEditParty =
    data.parties.find((party) => party.id === selectedEditPartyId) ??
    data.parties[0] ??
    null;
  const [editName, setEditName] = useState(selectedEditParty?.name ?? "");
  const [editType, setEditType] = useState<PartyType>(selectedEditParty?.type ?? "business");
  const [editRoles, setEditRoles] = useState<PartyRole[]>(selectedEditParty?.roles ?? []);
  const [editCountryCode, setEditCountryCode] = useState(selectedEditParty?.countryCode ?? "");
  const [editVatId, setEditVatId] = useState(selectedEditParty?.vatId ?? "");
  const [editAddressLine1, setEditAddressLine1] = useState(selectedEditParty?.addressLine1 ?? "");
  const [editAddressLine2, setEditAddressLine2] = useState(selectedEditParty?.addressLine2 ?? "");
  const [editPostalCode, setEditPostalCode] = useState(selectedEditParty?.postalCode ?? "");
  const [editCity, setEditCity] = useState(selectedEditParty?.city ?? "");
  const [editContactName, setEditContactName] = useState(selectedEditParty?.contactName ?? "");
  const [editEmail, setEditEmail] = useState(selectedEditParty?.email ?? "");
  const [editActive, setEditActive] = useState(selectedEditParty?.active ?? true);
  const [actionState, setActionState] = useState<"idle" | "saving" | "updating">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedEditParty) return;

    setSelectedEditPartyId(selectedEditParty.id);
    setEditName(selectedEditParty.name);
    setEditType(selectedEditParty.type);
    setEditRoles(selectedEditParty.roles);
    setEditCountryCode(selectedEditParty.countryCode ?? "");
    setEditVatId(selectedEditParty.vatId ?? "");
    setEditAddressLine1(selectedEditParty.addressLine1 ?? "");
    setEditAddressLine2(selectedEditParty.addressLine2 ?? "");
    setEditPostalCode(selectedEditParty.postalCode ?? "");
    setEditCity(selectedEditParty.city ?? "");
    setEditContactName(selectedEditParty.contactName ?? "");
    setEditEmail(selectedEditParty.email ?? "");
    setEditActive(selectedEditParty.active);
  }, [selectedEditParty]);

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
        vatId,
        addressLine1,
        addressLine2,
        postalCode,
        city,
        contactName,
        email
      });

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedEditPartyId(overview.parties.at(-1)?.id ?? "");
      setName("");
      setVatId("");
      setAddressLine1("");
      setAddressLine2("");
      setPostalCode("");
      setCity("");
      setContactName("");
      setEmail("");
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

  function toggleEditRole(role: PartyRole) {
    setEditRoles((currentRoles) =>
      currentRoles.includes(role)
        ? currentRoles.filter((currentRole) => currentRole !== role)
        : [...currentRoles, role]
    );
  }

  async function handleUpdateParty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionState("updating");
    setErrorMessage(null);

    try {
      if (!selectedEditParty) {
        throw new Error("Select a counterparty first.");
      }

      const overview = await updateParty({
        partyId: selectedEditParty.id,
        name: editName,
        type: editType,
        roles: editRoles,
        countryCode: editCountryCode,
        vatId: editVatId,
        addressLine1: editAddressLine1,
        addressLine2: editAddressLine2,
        postalCode: editPostalCode,
        city: editCity,
        contactName: editContactName,
        email: editEmail,
        active: editActive
      });

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Party was not updated.");
    } finally {
      setActionState("idle");
    }
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
        <div className="form-row">
          <label>
            <span>Address line 1</span>
            <input
              value={addressLine1}
              onChange={(event) => setAddressLine1(event.target.value)}
            />
          </label>
          <label>
            <span>Address line 2</span>
            <input
              value={addressLine2}
              onChange={(event) => setAddressLine2(event.target.value)}
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            <span>Postal code</span>
            <input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} />
          </label>
          <label>
            <span>City</span>
            <input value={city} onChange={(event) => setCity(event.target.value)} />
          </label>
        </div>
        <div className="form-row">
          <label>
            <span>Contact name</span>
            <input
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
            />
          </label>
          <label>
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
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
          <button
            className={`party-row ${
              selectedEditParty?.id === party.id ? "party-row-active" : ""
            }`}
            key={party.id}
            type="button"
            onClick={() => setSelectedEditPartyId(party.id)}
          >
            <div>
              <strong>{party.name}</strong>
              <span>
                {party.type} · {party.countryCode ?? "No country"}
                {party.vatId ? ` · ${party.vatId}` : ""}
                {party.city ? ` · ${party.city}` : ""}
                {party.active ? "" : " · inactive"}
              </span>
            </div>
            <div className="role-list">
              {party.roles.map((role) => (
                <span className="role-pill role-posting" key={`${party.id}-${role}`}>
                  {role}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      {selectedEditParty ? (
        <form
          className="invoice-form edit-party-form"
          onSubmit={(event) => void handleUpdateParty(event)}
        >
          <div className="form-row">
            <label>
              <span>Edit name</span>
              <input
                required
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
              />
            </label>
            <label>
              <span>Edit type</span>
              <select
                value={editType}
                onChange={(event) => setEditType(event.target.value as PartyType)}
              >
                <option value="business">Business</option>
                <option value="person">Person</option>
                <option value="government">Government</option>
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              <span>Edit country</span>
              <input
                value={editCountryCode}
                onChange={(event) => setEditCountryCode(event.target.value)}
              />
            </label>
            <label>
              <span>Edit VAT ID</span>
              <input value={editVatId} onChange={(event) => setEditVatId(event.target.value)} />
            </label>
          </div>
          <div className="form-row">
            <label>
              <span>Edit address line 1</span>
              <input
                value={editAddressLine1}
                onChange={(event) => setEditAddressLine1(event.target.value)}
              />
            </label>
            <label>
              <span>Edit address line 2</span>
              <input
                value={editAddressLine2}
                onChange={(event) => setEditAddressLine2(event.target.value)}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              <span>Edit postal code</span>
              <input
                value={editPostalCode}
                onChange={(event) => setEditPostalCode(event.target.value)}
              />
            </label>
            <label>
              <span>Edit city</span>
              <input value={editCity} onChange={(event) => setEditCity(event.target.value)} />
            </label>
          </div>
          <div className="form-row">
            <label>
              <span>Edit contact name</span>
              <input
                value={editContactName}
                onChange={(event) => setEditContactName(event.target.value)}
              />
            </label>
            <label>
              <span>Edit email</span>
              <input
                type="email"
                value={editEmail}
                onChange={(event) => setEditEmail(event.target.value)}
              />
            </label>
          </div>
          <div className="role-picker" aria-label="Edit party roles">
            {partyRoles.map((role) => (
              <label key={`edit-${role}`}>
                <input
                  type="checkbox"
                  checked={editRoles.includes(role)}
                  onChange={() => toggleEditRole(role)}
                />
                <span>{role}</span>
              </label>
            ))}
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={editActive}
              onChange={(event) => setEditActive(event.target.checked)}
            />
            <span>Active counterparty</span>
          </label>
          <button className="secondary-button" type="submit" disabled={actionState !== "idle"}>
            {actionState === "updating" ? "Saving" : "Save counterparty"}
          </button>
        </form>
      ) : null}

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
  const bankPostingAccounts = data.accounts.filter(
    (account) => account.role === "posting" && account.code.startsWith("11")
  );
  const [accountName, setAccountName] = useState("NLB EUR");
  const [accountCode, setAccountCode] = useState(bankPostingAccounts[0]?.code ?? "");
  const [iban, setIban] = useState("");
  const [selectedEditBankAccountId, setSelectedEditBankAccountId] = useState(
    data.bankAccounts[0]?.id ?? ""
  );
  const selectedEditBankAccount =
    data.bankAccounts.find((bankAccount) => bankAccount.id === selectedEditBankAccountId) ??
    data.bankAccounts[0] ??
    null;
  const [editAccountName, setEditAccountName] = useState(selectedEditBankAccount?.name ?? "");
  const [editAccountCode, setEditAccountCode] = useState(
    selectedEditBankAccount?.accountCode ?? bankPostingAccounts[0]?.code ?? ""
  );
  const [editIban, setEditIban] = useState(selectedEditBankAccount?.iban ?? "");
  const [editActive, setEditActive] = useState(selectedEditBankAccount?.active ?? true);
  const [transactionBankAccountId, setTransactionBankAccountId] = useState(
    data.bankAccounts[0]?.id ?? ""
  );
  const [bookingDate, setBookingDate] = useState("2026-05-15");
  const [transactionAmount, setTransactionAmount] = useState("1000.00");
  const [description, setDescription] = useState("Bank transaction");
  const [reference, setReference] = useState("");
  const [selectedEditBankTransactionId, setSelectedEditBankTransactionId] = useState(
    data.bankTransactions[0]?.id ?? ""
  );
  const selectedEditBankTransaction =
    data.bankTransactions.find(
      (bankTransaction) => bankTransaction.id === selectedEditBankTransactionId
    ) ??
    data.bankTransactions[0] ??
    null;
  const [editTransactionBankAccountId, setEditTransactionBankAccountId] = useState(
    selectedEditBankTransaction?.bankAccountId ?? data.bankAccounts[0]?.id ?? ""
  );
  const [editBookingDate, setEditBookingDate] = useState(
    selectedEditBankTransaction?.bookingDate ?? "2026-05-15"
  );
  const [editTransactionAmount, setEditTransactionAmount] = useState(
    selectedEditBankTransaction?.amount ?? "1000.00"
  );
  const [editReference, setEditReference] = useState(
    selectedEditBankTransaction?.reference ?? ""
  );
  const [editDescription, setEditDescription] = useState(
    selectedEditBankTransaction?.description ?? ""
  );
  const [actionState, setActionState] = useState<
    | "idle"
    | "account"
    | "account-update"
    | "statement-import"
    | "transaction"
    | "transaction-update"
    | "fee"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const selectedBankAccountId = transactionBankAccountId || data.bankAccounts[0]?.id || "";
  const activeBankAccounts = data.bankAccounts.filter((bankAccount) => bankAccount.active);
  const usedActiveAccountCodes = new Set(
    data.bankAccounts
      .filter((bankAccount) => bankAccount.active)
      .map((bankAccount) => bankAccount.accountCode)
  );
  const createBankAccountOptions = bankPostingAccounts.filter(
    (account) => !usedActiveAccountCodes.has(account.code)
  );
  const editBankAccountOptions = bankPostingAccounts.filter(
    (account) =>
      !usedActiveAccountCodes.has(account.code) ||
      account.code === selectedEditBankAccount?.accountCode
  );
  const ibanValidationMessage = getIbanValidationMessage(iban);
  const editIbanValidationMessage = getIbanValidationMessage(editIban);
  const canCreateBankAccount =
    actionState === "idle" &&
    createBankAccountOptions.length > 0 &&
    !ibanValidationMessage;

  useEffect(() => {
    if (!selectedEditBankAccount) return;

    setSelectedEditBankAccountId(selectedEditBankAccount.id);
    setEditAccountName(selectedEditBankAccount.name);
    setEditAccountCode(selectedEditBankAccount.accountCode);
    setEditIban(selectedEditBankAccount.iban ?? "");
    setEditActive(selectedEditBankAccount.active);
  }, [selectedEditBankAccount]);

  useEffect(() => {
    if (createBankAccountOptions.length > 0 && !createBankAccountOptions.some((account) => account.code === accountCode)) {
      setAccountCode(createBankAccountOptions[0]!.code);
    }
  }, [accountCode, createBankAccountOptions]);

  useEffect(() => {
    if (!selectedEditBankTransaction) return;

    setSelectedEditBankTransactionId(selectedEditBankTransaction.id);
    setEditTransactionBankAccountId(selectedEditBankTransaction.bankAccountId);
    setEditBookingDate(selectedEditBankTransaction.bookingDate);
    setEditTransactionAmount(selectedEditBankTransaction.amount);
    setEditReference(selectedEditBankTransaction.reference ?? "");
    setEditDescription(selectedEditBankTransaction.description);
  }, [selectedEditBankTransaction]);

  async function handleCreateBankAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    try {
      if (createBankAccountOptions.length === 0) {
        throw new Error("No unused bank posting accounts are available.");
      }

      if (ibanValidationMessage) {
        throw new Error(ibanValidationMessage);
      }

      setActionState("account");
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
      setSelectedEditBankAccountId(overview.bankAccounts.at(-1)?.id ?? "");
      setIban("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Bank account was not created."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleUpdateBankAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    try {
      if (!selectedEditBankAccount) {
        throw new Error("Select a bank account first.");
      }

      if (editIbanValidationMessage) {
        throw new Error(editIbanValidationMessage);
      }

      setActionState("account-update");
      const overview = await updateBankAccount({
        bankAccountId: selectedEditBankAccount.id,
        name: editAccountName,
        accountCode: editAccountCode,
        iban: editIban,
        active: editActive
      });

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedEditBankTransactionId(overview.bankTransactions.at(-1)?.id ?? "");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Bank account was not updated."
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

  async function handleImportStatement(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);

    if (files.length === 0) return;

    setActionState("statement-import");
    setErrorMessage(null);
    setImportMessage(null);

    try {
      if (!selectedBankAccountId) {
        throw new Error("Create or select a bank account first.");
      }

      let nextOverview: WorkspaceOverview | null = null;
      let importedCount = 0;
      let skippedCount = 0;
      const failedFiles: string[] = [];

      for (const file of files) {
        try {
          const result = await importCamt053BankTransactions({
            workspaceId: data.workspace.id,
            bankAccountId: selectedBankAccountId,
            xml: await file.text()
          });

          nextOverview = result.overview;
          importedCount += result.importedCount;
          skippedCount += result.skippedCount;
        } catch {
          failedFiles.push(file.name);
        }
      }

      if (!nextOverview) {
        throw new Error("No selected bank statements could be imported.");
      }

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(nextOverview)
      });
      setImportMessage(
        `Imported ${importedCount} transactions, skipped ${skippedCount} duplicates from ${files.length - failedFiles.length} files.`
      );

      if (failedFiles.length > 0) {
        setErrorMessage(`Some files were not imported: ${failedFiles.join(", ")}.`);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Bank statement was not imported."
      );
    } finally {
      event.currentTarget.value = "";
      setActionState("idle");
    }
  }

  async function handleUpdateBankTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    try {
      if (!selectedEditBankTransaction) {
        throw new Error("Select a bank transaction first.");
      }

      setActionState("transaction-update");
      const overview = await updateBankTransaction({
        bankTransactionId: selectedEditBankTransaction.id,
        bankAccountId: editTransactionBankAccountId,
        bookingDate: editBookingDate,
        amount: editTransactionAmount,
        description: editDescription,
        reference: editReference
      });

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Bank transaction was not updated."
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
        <span>
          {data.bankAccounts.length} accounts · {data.bankTransactions.length} transactions
        </span>
      </div>

      <div className="banking-section">
        <div className="subsection-header">
          <div>
            <h3>Bank accounts</h3>
            <p>Each active bank account uses a dedicated posting account.</p>
          </div>
        </div>

        <form className="invoice-form" onSubmit={(event) => void handleCreateBankAccount(event)}>
          <div className="form-row">
            <label>
              <span>Account name</span>
              <input value={accountName} onChange={(event) => setAccountName(event.target.value)} />
            </label>
            <label>
              <span>Account code</span>
              <select value={accountCode} onChange={(event) => setAccountCode(event.target.value)}>
                {createBankAccountOptions.map((account) => (
                  <option key={account.id} value={account.code}>
                    {account.code} · {account.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            <span>IBAN</span>
            <input
              aria-invalid={ibanValidationMessage ? "true" : "false"}
              placeholder="SI56 1910 0000 0123 438"
              value={iban}
              onChange={(event) => setIban(event.target.value)}
            />
          </label>
          {ibanValidationMessage ? (
            <p className="field-error">{ibanValidationMessage}</p>
          ) : null}
          {createBankAccountOptions.length === 0 ? (
            <p className="field-note">No unused bank posting accounts are available.</p>
          ) : null}
          <button
            className="primary-button"
            type="submit"
            disabled={!canCreateBankAccount}
          >
            {actionState === "account" ? "Creating" : "Create bank account"}
          </button>
        </form>

        <div className="bank-account-list">
          {data.bankAccounts.length === 0 ? (
            <p className="empty-state">No bank accounts yet.</p>
          ) : null}
          {data.bankAccounts.map((bankAccount) => (
            <button
              className={`bank-account-row ${
                selectedEditBankAccount?.id === bankAccount.id ? "bank-account-row-active" : ""
              }`}
              key={bankAccount.id}
              type="button"
              onClick={() => setSelectedEditBankAccountId(bankAccount.id)}
            >
              <strong>{bankAccount.name}</strong>
              <span>
                {bankAccount.accountCode} · {bankAccount.currency}
                {bankAccount.iban ? ` · ${bankAccount.iban}` : ""}
              </span>
              <small>{bankAccount.active ? "active" : "inactive"}</small>
            </button>
          ))}
        </div>

        {selectedEditBankAccount ? (
          <form
            className="invoice-form edit-bank-account-form"
            onSubmit={(event) => void handleUpdateBankAccount(event)}
          >
            <div className="form-row">
              <label>
                <span>Edit name</span>
                <input
                  value={editAccountName}
                  onChange={(event) => setEditAccountName(event.target.value)}
                />
              </label>
              <label>
                <span>Edit posting account</span>
                <select
                  value={editAccountCode}
                  onChange={(event) => setEditAccountCode(event.target.value)}
                >
                  {editBankAccountOptions.map((account) => (
                    <option key={account.id} value={account.code}>
                      {account.code} · {account.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              <span>Edit IBAN</span>
              <input
                aria-invalid={editIbanValidationMessage ? "true" : "false"}
                placeholder="SI56 1910 0000 0123 438"
                value={editIban}
                onChange={(event) => setEditIban(event.target.value)}
              />
            </label>
            {editIbanValidationMessage ? (
              <p className="field-error">{editIbanValidationMessage}</p>
            ) : null}
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={editActive}
                onChange={(event) => setEditActive(event.target.checked)}
              />
              <span>Active bank account</span>
            </label>
            <button
              className="secondary-button"
              type="submit"
              disabled={actionState !== "idle" || Boolean(editIbanValidationMessage)}
            >
              {actionState === "account-update" ? "Saving" : "Save bank account"}
            </button>
          </form>
        ) : null}
      </div>

      <div className="banking-section">
        <div className="subsection-header">
          <div>
            <h3>Statement import</h3>
            <p>Import ISO 20022 CAMT.053 XML statements into the selected bank account.</p>
          </div>
        </div>

        <div className="statement-import-row">
          <label>
            <span>Bank account</span>
            <select
              value={selectedBankAccountId}
              onChange={(event) => setTransactionBankAccountId(event.target.value)}
            >
              <option value="">Select bank account</option>
              {activeBankAccounts.map((bankAccount) => (
                <option key={bankAccount.id} value={bankAccount.id}>
                  {bankAccount.name} · {bankAccount.accountCode}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>CAMT.053 XML</span>
            <input
              accept=".xml,application/xml,text/xml"
              disabled={actionState !== "idle" || !selectedBankAccountId}
              multiple
              type="file"
              onChange={(event) => void handleImportStatement(event)}
            />
          </label>
        </div>
        {actionState === "statement-import" ? (
          <p className="field-note">Importing bank statement.</p>
        ) : null}
        {importMessage ? <p className="field-note">{importMessage}</p> : null}
      </div>

      <div className="banking-section">
        <div className="subsection-header">
          <div>
            <h3>Bank transactions</h3>
            <p>Add signed account movements and match them to documents.</p>
          </div>
        </div>

        <form className="invoice-form" onSubmit={(event) => void handleCreateBankTransaction(event)}>
          <div className="form-row">
            <label>
              <span>Bank account</span>
              <select
                value={selectedBankAccountId}
                onChange={(event) => setTransactionBankAccountId(event.target.value)}
              >
                <option value="">Select bank account</option>
                {activeBankAccounts.map((bankAccount) => (
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
                <button
                  className={`transaction-pick ${
                    selectedEditBankTransaction?.id === bankTransaction.id
                      ? "transaction-pick-active"
                      : ""
                  }`}
                  type="button"
                  onClick={() => setSelectedEditBankTransactionId(bankTransaction.id)}
                >
                  <strong>
                    {bankTransaction.amount} {bankTransaction.currency}
                  </strong>
                  <span>
                    {bankTransaction.bookingDate} · {bankAccount?.name ?? "Unknown account"} ·{" "}
                    {bankTransaction.status}
                  </span>
                  <small>{bankTransaction.description}</small>
                  {bankTransaction.counterpartyName || bankTransaction.externalId ? (
                    <span className="transaction-details">
                      <span>
                        Counterparty: {bankTransaction.counterpartyName ?? "Unknown"}
                      </span>
                      {bankTransaction.counterpartyIban ? (
                        <span>Counterparty IBAN: {bankTransaction.counterpartyIban}</span>
                      ) : null}
                      {bankTransaction.reference ? (
                        <span>Reference: {bankTransaction.reference}</span>
                      ) : null}
                      {bankTransaction.remittanceInformation ? (
                        <span>Remittance: {bankTransaction.remittanceInformation}</span>
                      ) : null}
                      {bankTransaction.valueDate ? (
                        <span>Value date: {bankTransaction.valueDate}</span>
                      ) : null}
                      {bankTransaction.bankReference ? (
                        <span>Bank reference: {bankTransaction.bankReference}</span>
                      ) : null}
                    </span>
                  ) : null}
                </button>
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

        {selectedEditBankTransaction ? (
          <form
            className="invoice-form edit-bank-account-form"
            onSubmit={(event) => void handleUpdateBankTransaction(event)}
          >
            <div className="form-row">
              <label>
                <span>Edit bank account</span>
                <select
                  value={editTransactionBankAccountId}
                  onChange={(event) => setEditTransactionBankAccountId(event.target.value)}
                  disabled={selectedEditBankTransaction.status !== "unmatched"}
                >
                  {activeBankAccounts.map((bankAccount) => (
                    <option key={bankAccount.id} value={bankAccount.id}>
                      {bankAccount.name} · {bankAccount.accountCode}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Edit booking date</span>
                <input
                  type="date"
                  value={editBookingDate}
                  disabled={selectedEditBankTransaction.status !== "unmatched"}
                  onChange={(event) => setEditBookingDate(event.target.value)}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                <span>Edit signed amount</span>
                <input
                  value={editTransactionAmount}
                  disabled={selectedEditBankTransaction.status !== "unmatched"}
                  onChange={(event) => setEditTransactionAmount(event.target.value)}
                />
              </label>
              <label>
                <span>Edit reference</span>
                <input
                  value={editReference}
                  disabled={selectedEditBankTransaction.status !== "unmatched"}
                  onChange={(event) => setEditReference(event.target.value)}
                />
              </label>
            </div>
            <label>
              <span>Edit description</span>
              <input
                value={editDescription}
                disabled={selectedEditBankTransaction.status !== "unmatched"}
                onChange={(event) => setEditDescription(event.target.value)}
              />
            </label>
            {selectedEditBankTransaction.status !== "unmatched" ? (
              <p className="field-note">
                Processed bank transactions cannot be edited after matching or posting.
              </p>
            ) : null}
            <button
              className="secondary-button"
              type="submit"
              disabled={
                actionState !== "idle" || selectedEditBankTransaction.status !== "unmatched"
              }
            >
              {actionState === "transaction-update"
                ? "Saving"
                : "Save bank transaction"}
            </button>
          </form>
        ) : null}
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
              <PartyInvoiceDetails
                party={selectedInvoiceParty}
                fallbackLabel="Unknown customer"
              />
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
              <PartyInvoiceDetails
                party={selectedSupplierInvoiceParty}
                fallbackLabel="Unknown supplier"
              />
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
