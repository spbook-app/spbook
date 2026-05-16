import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import type {
  Account,
  AccountRole,
  BankTransaction,
  JournalEntry,
  PartyRole,
  PartyType
} from "../domain";
import { createWorkspaceAccount, updateWorkspaceAccount } from "../services/account-workflow";
import type { AccountBalance } from "../services/balances";
import {
  createBankAccount,
  createBankTransaction,
  isValidIban,
  linkBankTransactionParty,
  matchInvoicePaymentFromBankTransaction,
  matchSupplierPaymentFromBankTransaction,
  postBankFeeFromBankTransaction,
  undoBankTransactionPosting,
  updateBankAccount,
  updateBankTransaction
} from "../services/bank-workflow";
import {
  autoLinkImportedBankTransactions,
  importCamt053BankTransactions
} from "../services/camt053-import";
import {
  createSalesInvoice,
  deleteSalesInvoice,
  updateSalesInvoice
} from "../services/invoice-workflow";
import {
  recordOwnerContribution,
  recordOwnerWithdrawal
} from "../services/owner-transactions-workflow";
import { createParty, updateParty } from "../services/party-workflow";
import {
  createSupplierInvoice,
  deleteSupplierInvoice,
  updateSupplierInvoice
} from "../services/supplier-invoice-workflow";
import { mapOverviewToReadyState } from "../shared/lib/workspace-overview";
import type { WorkspaceOverview } from "../services/workspace-overview";
import {
  getSectionLead,
  type WorkspaceSection,
  workspaceSections
} from "../pages/workspace/model";
import { SettingsPanel } from "../widgets/settings/SettingsPanel";
import { WorkspaceSidebar } from "../widgets/workspace-sidebar/WorkspaceSidebar";
import type { AppDataState } from "./App";

const partyRoles: PartyRole[] = ["customer", "supplier", "tax_authority", "bank", "owner"];

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
            <AccountsTable data={data} onDataStateChange={onDataStateChange} />
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
    party.region,
    party.countryCode
  ].filter(Boolean);
  const contact = [party.contactName, party.email].filter(Boolean).join(" · ");

  return (
    <dd className="party-detail">
      <strong>{party.name}</strong>
      {party.registrationNumber ? (
        <span>Register number: {party.registrationNumber}</span>
      ) : null}
      {party.vatId ? <span>{party.vatId}</span> : null}
      {party.iban ? <span>{party.iban}</span> : null}
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

function isSameStatementCounterparty(
  partyName: string,
  partyIban: string | undefined,
  statementCounterpartyName: string | undefined,
  statementCounterpartyIban: string | undefined
) {
  const normalizedPartyIban = normalizeIbanForCompare(partyIban);
  const normalizedStatementIban = normalizeIbanForCompare(statementCounterpartyIban);

  if (normalizedPartyIban && normalizedPartyIban === normalizedStatementIban) {
    return true;
  }

  return (
    partyName.trim().toLowerCase() ===
    statementCounterpartyName?.trim().toLowerCase()
  );
}

function normalizeIbanForCompare(iban: string | undefined) {
  return iban?.replace(/\s+/g, "").toUpperCase() ?? "";
}

function isIncomingBankTransaction(bankTransaction: BankTransaction) {
  return !bankTransaction.amount.startsWith("-");
}

function absoluteBankTransactionAmount(bankTransaction: BankTransaction) {
  return bankTransaction.amount.startsWith("-")
    ? bankTransaction.amount.slice(1)
    : bankTransaction.amount;
}

function AccountsTable({
  data,
  onDataStateChange
}: {
  data: Extract<AppDataState, { state: "ready" }>;
  onDataStateChange: (state: AppDataState) => void;
}) {
  const accounts = data.accounts;
  const groupAccounts = accounts.filter((account) => account.role === "group");
  const [code, setCode] = useState("1101");
  const [name, setName] = useState("Second bank account");
  const [role, setRole] = useState<AccountRole>("posting");
  const [parentCode, setParentCode] = useState("11");
  const [currency, setCurrency] = useState(data.workspace.baseCurrency);
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id ?? "");
  const selectedAccount =
    accounts.find((account) => account.id === selectedAccountId) ?? accounts[0] ?? null;
  const [editName, setEditName] = useState(selectedAccount?.name ?? "");
  const [editParentCode, setEditParentCode] = useState(selectedAccount?.parentCode ?? "");
  const [editCurrency, setEditCurrency] = useState(selectedAccount?.currency ?? "");
  const [editActive, setEditActive] = useState(selectedAccount?.active ?? true);
  const [actionState, setActionState] = useState<"idle" | "creating" | "updating">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAccount) return;

    setSelectedAccountId(selectedAccount.id);
    setEditName(selectedAccount.name);
    setEditParentCode(selectedAccount.parentCode ?? "");
    setEditCurrency(selectedAccount.currency ?? "");
    setEditActive(selectedAccount.active);
  }, [selectedAccount]);

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

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedAccountId(overview.accounts.find((account) => account.code === code)?.id ?? "");
      setCode("");
      setName("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Account was not created.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleUpdateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setActionState("updating");

    try {
      if (!selectedAccount) {
        throw new Error("Select an account first.");
      }

      const overview = await updateWorkspaceAccount({
        accountId: selectedAccount.id,
        name: editName,
        parentCode: selectedAccount.role === "posting" ? editParentCode : undefined,
        currency: selectedAccount.role === "posting" ? editCurrency : undefined,
        active: editActive
      });

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Account was not updated.");
    } finally {
      setActionState("idle");
    }
  }

  return (
    <section className="panel panel-wide" aria-labelledby="accounts-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Chart</p>
          <h2 id="accounts-title">Workspace accounts</h2>
        </div>
        <span>{accounts.length} accounts</span>
      </div>
      <form className="invoice-form" onSubmit={(event) => void handleCreateAccount(event)}>
        <div className="form-row">
          <label>
            <span>Code</span>
            <input value={code} onChange={(event) => setCode(event.target.value)} />
          </label>
          <label>
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
        </div>
        <div className="form-row">
          <label>
            <span>Role</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as AccountRole)}
            >
              <option value="posting">Posting</option>
              <option value="group">Group</option>
            </select>
          </label>
          <label>
            <span>Parent group</span>
            <select
              value={parentCode}
              disabled={role !== "posting"}
              onChange={(event) => setParentCode(event.target.value)}
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
            onChange={(event) => setCurrency(event.target.value)}
          />
        </label>
        <button className="primary-button" type="submit" disabled={actionState !== "idle"}>
          {actionState === "creating" ? "Creating" : "Create account"}
        </button>
      </form>
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
              <tr
                className={selectedAccount?.id === account.id ? "selected-row" : ""}
                key={account.id}
                onClick={() => setSelectedAccountId(account.id)}
              >
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
      {selectedAccount ? (
        <form
          className="invoice-form edit-bank-account-form"
          onSubmit={(event) => void handleUpdateAccount(event)}
        >
          <div className="form-row">
            <label>
              <span>Code</span>
              <input disabled value={selectedAccount.code} />
            </label>
            <label>
              <span>Role</span>
              <input disabled value={selectedAccount.role} />
            </label>
          </div>
          <label>
            <span>Edit name</span>
            <input value={editName} onChange={(event) => setEditName(event.target.value)} />
          </label>
          <div className="form-row">
            <label>
              <span>Edit parent group</span>
              <select
                value={editParentCode}
                disabled={selectedAccount.role !== "posting"}
                onChange={(event) => setEditParentCode(event.target.value)}
              >
                <option value="">No parent</option>
                {groupAccounts.map((account) => (
                  <option key={account.id} value={account.code}>
                    {account.code} · {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Edit currency</span>
              <input
                disabled={selectedAccount.role !== "posting"}
                value={editCurrency}
                onChange={(event) => setEditCurrency(event.target.value)}
              />
            </label>
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={editActive}
              onChange={(event) => setEditActive(event.target.checked)}
            />
            <span>Active account</span>
          </label>
          <p className="field-note">
            Account code and role are fixed after creation because journal entries refer to
            account codes.
          </p>
          <button className="secondary-button" type="submit" disabled={actionState !== "idle"}>
            {actionState === "updating" ? "Saving" : "Save account"}
          </button>
        </form>
      ) : null}
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
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
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [vatId, setVatId] = useState("");
  const [partyIban, setPartyIban] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
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
  const [editRegistrationNumber, setEditRegistrationNumber] = useState(
    selectedEditParty?.registrationNumber ?? ""
  );
  const [editVatId, setEditVatId] = useState(selectedEditParty?.vatId ?? "");
  const [editPartyIban, setEditPartyIban] = useState(selectedEditParty?.iban ?? "");
  const [editAddressLine1, setEditAddressLine1] = useState(selectedEditParty?.addressLine1 ?? "");
  const [editAddressLine2, setEditAddressLine2] = useState(selectedEditParty?.addressLine2 ?? "");
  const [editPostalCode, setEditPostalCode] = useState(selectedEditParty?.postalCode ?? "");
  const [editCity, setEditCity] = useState(selectedEditParty?.city ?? "");
  const [editRegion, setEditRegion] = useState(selectedEditParty?.region ?? "");
  const [editContactName, setEditContactName] = useState(selectedEditParty?.contactName ?? "");
  const [editEmail, setEditEmail] = useState(selectedEditParty?.email ?? "");
  const [editActive, setEditActive] = useState(selectedEditParty?.active ?? true);
  const [actionState, setActionState] = useState<"idle" | "saving" | "updating">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const partyIbanValidationMessage = getIbanValidationMessage(partyIban);
  const editPartyIbanValidationMessage = getIbanValidationMessage(editPartyIban);

  useEffect(() => {
    if (!selectedEditParty) return;

    setSelectedEditPartyId(selectedEditParty.id);
    setEditName(selectedEditParty.name);
    setEditType(selectedEditParty.type);
    setEditRoles(selectedEditParty.roles);
    setEditCountryCode(selectedEditParty.countryCode ?? "");
    setEditRegistrationNumber(selectedEditParty.registrationNumber ?? "");
    setEditVatId(selectedEditParty.vatId ?? "");
    setEditPartyIban(selectedEditParty.iban ?? "");
    setEditAddressLine1(selectedEditParty.addressLine1 ?? "");
    setEditAddressLine2(selectedEditParty.addressLine2 ?? "");
    setEditPostalCode(selectedEditParty.postalCode ?? "");
    setEditCity(selectedEditParty.city ?? "");
    setEditRegion(selectedEditParty.region ?? "");
    setEditContactName(selectedEditParty.contactName ?? "");
    setEditEmail(selectedEditParty.email ?? "");
    setEditActive(selectedEditParty.active);
  }, [selectedEditParty]);

  async function handleCreateParty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionState("saving");
    setErrorMessage(null);

    try {
      if (partyIbanValidationMessage) {
        throw new Error(partyIbanValidationMessage);
      }

      const overview = await createParty({
        workspaceId: data.workspace.id,
        name,
        type,
        roles,
        countryCode,
        registrationNumber,
        vatId,
        iban: partyIban,
        addressLine1,
        addressLine2,
        postalCode,
        city,
        region,
        contactName,
        email
      });

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedEditPartyId(overview.parties.at(-1)?.id ?? "");
      setName("");
      setRegistrationNumber("");
      setVatId("");
      setPartyIban("");
      setAddressLine1("");
      setAddressLine2("");
      setPostalCode("");
      setCity("");
      setRegion("");
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

      if (editPartyIbanValidationMessage) {
        throw new Error(editPartyIbanValidationMessage);
      }

      const overview = await updateParty({
        partyId: selectedEditParty.id,
        name: editName,
        type: editType,
        roles: editRoles,
        countryCode: editCountryCode,
        registrationNumber: editRegistrationNumber,
        vatId: editVatId,
        iban: editPartyIban,
        addressLine1: editAddressLine1,
        addressLine2: editAddressLine2,
        postalCode: editPostalCode,
        city: editCity,
        region: editRegion,
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
        <label>
          <span>Registration number</span>
          <input
            value={registrationNumber}
            onChange={(event) => setRegistrationNumber(event.target.value)}
          />
        </label>
        <label>
          <span>IBAN</span>
          <input
            aria-invalid={partyIbanValidationMessage ? "true" : "false"}
            placeholder="SI56 1910 0000 0123 438"
            value={partyIban}
            onChange={(event) => setPartyIban(event.target.value)}
          />
        </label>
        {partyIbanValidationMessage ? (
          <p className="field-error">{partyIbanValidationMessage}</p>
        ) : null}
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
        <label>
          <span>Region / county</span>
          <input value={region} onChange={(event) => setRegion(event.target.value)} />
        </label>
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
                {party.registrationNumber ? ` · ${party.registrationNumber}` : ""}
                {party.vatId ? ` · ${party.vatId}` : ""}
                {party.iban ? ` · ${party.iban}` : ""}
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
          <label>
            <span>Edit registration number</span>
            <input
              value={editRegistrationNumber}
              onChange={(event) => setEditRegistrationNumber(event.target.value)}
            />
          </label>
          <label>
            <span>Edit IBAN</span>
            <input
              aria-invalid={editPartyIbanValidationMessage ? "true" : "false"}
              placeholder="SI56 1910 0000 0123 438"
              value={editPartyIban}
              onChange={(event) => setEditPartyIban(event.target.value)}
            />
          </label>
          {editPartyIbanValidationMessage ? (
            <p className="field-error">{editPartyIbanValidationMessage}</p>
          ) : null}
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
          <label>
            <span>Edit region / county</span>
            <input value={editRegion} onChange={(event) => setEditRegion(event.target.value)} />
          </label>
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
  const bankParties = data.parties.filter(
    (party) => party.active && party.roles.includes("bank")
  );
  const [accountName, setAccountName] = useState("NLB EUR");
  const [accountCode, setAccountCode] = useState(bankPostingAccounts[0]?.code ?? "");
  const [iban, setIban] = useState("");
  const [bankPartyId, setBankPartyId] = useState(bankParties[0]?.id ?? "");
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
  const [editBankPartyId, setEditBankPartyId] = useState(
    selectedEditBankAccount?.partyId ?? ""
  );
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
  const canEditSelectedBankTransaction =
    selectedEditBankTransaction?.status === "unmatched" &&
    !selectedEditBankTransaction.importSource;
  const selectedStatementCounterpartyExists = selectedEditBankTransaction
    ? data.parties.some((party) =>
        isSameStatementCounterparty(
          party.name,
          party.iban,
          selectedEditBankTransaction.counterpartyName,
          selectedEditBankTransaction.counterpartyIban
        )
      )
    : false;
  const selectedStatementCounterpartyCandidate = selectedEditBankTransaction
    ? data.parties.find((party) =>
        isSameStatementCounterparty(
          party.name,
          party.iban,
          selectedEditBankTransaction.counterpartyName,
          selectedEditBankTransaction.counterpartyIban
        )
      ) ?? null
    : null;
  const canCreateCounterpartyFromSelectedTransaction = Boolean(
    selectedEditBankTransaction?.importSource &&
      selectedEditBankTransaction.counterpartyName &&
      !selectedStatementCounterpartyExists
  );
  const suggestedInvoiceMatch =
    selectedEditBankTransaction?.status === "unmatched" &&
    selectedEditBankTransaction.partyId &&
    isIncomingBankTransaction(selectedEditBankTransaction)
      ? data.invoices.find(
          (invoice) =>
            invoice.partyId === selectedEditBankTransaction.partyId &&
            invoice.status !== "paid" &&
            invoice.status !== "cancelled" &&
            invoice.currency === selectedEditBankTransaction.currency &&
            invoice.total === selectedEditBankTransaction.amount
        ) ?? null
      : null;
  const suggestedSupplierInvoiceMatch =
    selectedEditBankTransaction?.status === "unmatched" &&
    selectedEditBankTransaction.partyId &&
    !isIncomingBankTransaction(selectedEditBankTransaction)
      ? data.supplierInvoices.find(
          (supplierInvoice) =>
            supplierInvoice.partyId === selectedEditBankTransaction.partyId &&
            supplierInvoice.status !== "paid" &&
            supplierInvoice.status !== "cancelled" &&
            supplierInvoice.currency === selectedEditBankTransaction.currency &&
            supplierInvoice.total ===
              absoluteBankTransactionAmount(selectedEditBankTransaction)
        ) ?? null
      : null;
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
  const [linkedPartyId, setLinkedPartyId] = useState(
    selectedEditBankTransaction?.partyId ?? selectedStatementCounterpartyCandidate?.id ?? ""
  );
  const [actionState, setActionState] = useState<
    | "idle"
    | "account"
    | "account-update"
    | "auto-link"
    | "statement-import"
    | "party-create"
    | "party-link"
    | "transaction"
    | "transaction-update"
    | "invoice-match"
    | "supplier-match"
    | "fee"
    | "undo"
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
    setEditBankPartyId(selectedEditBankAccount.partyId ?? "");
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
    setLinkedPartyId(
      selectedEditBankTransaction.partyId ?? selectedStatementCounterpartyCandidate?.id ?? ""
    );
  }, [selectedEditBankTransaction, selectedStatementCounterpartyCandidate?.id]);

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
        iban,
        partyId: bankPartyId
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
        partyId: editBankPartyId,
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

  async function handleAutoLinkImportedTransactions() {
    setActionState("auto-link");
    setErrorMessage(null);
    setImportMessage(null);

    try {
      const result = await autoLinkImportedBankTransactions(data.workspace.id);

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(result.overview)
      });
      setImportMessage(`Linked ${result.linkedCount} imported transactions.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Imported transactions were not auto-linked."
      );
    } finally {
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

  async function handleCreateCounterpartyFromBankTransaction() {
    setErrorMessage(null);

    try {
      if (!selectedEditBankTransaction?.counterpartyName) {
        throw new Error("Selected bank transaction has no counterparty name.");
      }

      if (selectedStatementCounterpartyExists) {
        throw new Error("Counterparty already exists.");
      }

      setActionState("party-create");
      const overview = await createParty({
        workspaceId: data.workspace.id,
        name: selectedEditBankTransaction.counterpartyName,
        type: "business",
        roles: [selectedEditBankTransaction.amount.startsWith("-") ? "supplier" : "customer"],
        countryCode:
          selectedEditBankTransaction.counterpartyIban?.slice(0, 2) ??
          data.workspace.countryCode,
        iban: selectedEditBankTransaction.counterpartyIban
      });
      const createdParty = overview.parties.find((party) =>
        isSameStatementCounterparty(
          party.name,
          party.iban,
          selectedEditBankTransaction.counterpartyName,
          selectedEditBankTransaction.counterpartyIban
        )
      );
      const linkedOverview = createdParty
        ? await linkBankTransactionParty({
            bankTransactionId: selectedEditBankTransaction.id,
            partyId: createdParty.id
          })
        : overview;

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(linkedOverview)
      });
      setSelectedEditBankTransactionId(selectedEditBankTransaction.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Counterparty was not created."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleLinkBankTransactionParty() {
    setErrorMessage(null);

    try {
      if (!selectedEditBankTransaction) {
        throw new Error("Select a bank transaction first.");
      }

      setActionState("party-link");
      const overview = await linkBankTransactionParty({
        bankTransactionId: selectedEditBankTransaction.id,
        partyId: linkedPartyId
      });

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedEditBankTransactionId(selectedEditBankTransaction.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Counterparty was not linked."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleMatchSuggestedInvoice(invoiceId: string) {
    setActionState("invoice-match");
    setErrorMessage(null);

    try {
      if (!selectedEditBankTransaction) {
        throw new Error("Select a bank transaction first.");
      }

      const overview = await matchInvoicePaymentFromBankTransaction(
        invoiceId,
        selectedEditBankTransaction.id
      );

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedEditBankTransactionId(selectedEditBankTransaction.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Invoice payment was not matched."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleMatchSuggestedSupplierInvoice(supplierInvoiceId: string) {
    setActionState("supplier-match");
    setErrorMessage(null);

    try {
      if (!selectedEditBankTransaction) {
        throw new Error("Select a bank transaction first.");
      }

      const overview = await matchSupplierPaymentFromBankTransaction(
        supplierInvoiceId,
        selectedEditBankTransaction.id
      );

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedEditBankTransactionId(selectedEditBankTransaction.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Supplier invoice payment was not matched."
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

  async function handleUndoBankTransactionPosting(bankTransactionId: string) {
    setActionState("undo");
    setErrorMessage(null);

    try {
      const overview = await undoBankTransactionPosting(bankTransactionId);

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedEditBankTransactionId(bankTransactionId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Posting was not undone.");
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
            <span>Bank party</span>
            <select value={bankPartyId} onChange={(event) => setBankPartyId(event.target.value)}>
              <option value="">No bank party</option>
              {bankParties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.name}
                  {party.iban ? ` · ${party.iban}` : ""}
                </option>
              ))}
            </select>
          </label>
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
              {bankAccount.partyId ? (
                <small>
                  {data.parties.find((party) => party.id === bankAccount.partyId)?.name ??
                    "Unknown bank party"}
                </small>
              ) : null}
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
              <span>Edit bank party</span>
              <select
                value={editBankPartyId}
                onChange={(event) => setEditBankPartyId(event.target.value)}
              >
                <option value="">No bank party</option>
                {bankParties.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.name}
                    {party.iban ? ` · ${party.iban}` : ""}
                  </option>
                ))}
              </select>
            </label>
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
        <button
          className="secondary-button"
          type="button"
          disabled={actionState !== "idle"}
          onClick={() => void handleAutoLinkImportedTransactions()}
        >
          {actionState === "auto-link" ? "Auto-linking" : "Auto-link imported transactions"}
        </button>
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
                        Statement counterparty: {bankTransaction.counterpartyName ?? "Unknown"}
                      </span>
                      {bankTransaction.counterpartyIban ? (
                        <span>
                          Statement counterparty IBAN: {bankTransaction.counterpartyIban}
                        </span>
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
            <BankTransactionDetailPanel
              bankAccountName={
                data.bankAccounts.find(
                  (bankAccount) =>
                    bankAccount.id === selectedEditBankTransaction.bankAccountId
                )?.name ?? "Unknown account"
              }
              bankTransaction={selectedEditBankTransaction}
              canCreateCounterparty={canCreateCounterpartyFromSelectedTransaction}
              counterpartyExists={selectedStatementCounterpartyExists}
              isLinkingCounterparty={actionState === "party-link"}
              isCreatingCounterparty={actionState === "party-create"}
              linkedPartyId={linkedPartyId}
              parties={data.parties}
              suggestedPartyId={selectedStatementCounterpartyCandidate?.id}
              suggestedInvoice={suggestedInvoiceMatch}
              suggestedSupplierInvoice={suggestedSupplierInvoiceMatch}
              isMatchingInvoice={actionState === "invoice-match"}
              isMatchingSupplierInvoice={actionState === "supplier-match"}
              isPostingBankFee={actionState === "fee"}
              isUndoingPosting={actionState === "undo"}
              onCreateCounterparty={() => void handleCreateCounterpartyFromBankTransaction()}
              onMatchInvoice={(invoiceId) => void handleMatchSuggestedInvoice(invoiceId)}
              onMatchSupplierInvoice={(supplierInvoiceId) =>
                void handleMatchSuggestedSupplierInvoice(supplierInvoiceId)
              }
              onPostBankFee={() => void handlePostBankFee(selectedEditBankTransaction.id)}
              onLinkCounterparty={() => void handleLinkBankTransactionParty()}
              onLinkedPartyChange={setLinkedPartyId}
              onUndoPosting={() =>
                void handleUndoBankTransactionPosting(selectedEditBankTransaction.id)
              }
            />
            <div className="form-row">
              <label>
                <span>Edit bank account</span>
                <select
                  value={editTransactionBankAccountId}
                  onChange={(event) => setEditTransactionBankAccountId(event.target.value)}
                  disabled={!canEditSelectedBankTransaction}
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
                  disabled={!canEditSelectedBankTransaction}
                  onChange={(event) => setEditBookingDate(event.target.value)}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                <span>Edit signed amount</span>
                <input
                  value={editTransactionAmount}
                  disabled={!canEditSelectedBankTransaction}
                  onChange={(event) => setEditTransactionAmount(event.target.value)}
                />
              </label>
              <label>
                <span>Edit reference</span>
                <input
                  value={editReference}
                  disabled={!canEditSelectedBankTransaction}
                  onChange={(event) => setEditReference(event.target.value)}
                />
              </label>
            </div>
            <label>
              <span>Edit description</span>
              <input
                value={editDescription}
                disabled={!canEditSelectedBankTransaction}
                onChange={(event) => setEditDescription(event.target.value)}
              />
            </label>
            {selectedEditBankTransaction.importSource ? (
              <p className="field-note">
                Imported bank statement entries cannot be edited. Match, post, or
                ignore them instead.
              </p>
            ) : null}
            {selectedEditBankTransaction.status !== "unmatched" ? (
              <p className="field-note">
                Processed bank transactions cannot be edited after matching or posting.
              </p>
            ) : null}
            <button
              className="secondary-button"
              type="submit"
              disabled={
                actionState !== "idle" || !canEditSelectedBankTransaction
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

function BankTransactionDetailPanel({
  bankAccountName,
  bankTransaction,
  canCreateCounterparty,
  counterpartyExists,
  isLinkingCounterparty,
  isCreatingCounterparty,
  linkedPartyId,
  parties,
  suggestedPartyId,
  suggestedInvoice,
  suggestedSupplierInvoice,
  isMatchingInvoice,
  isMatchingSupplierInvoice,
  isPostingBankFee,
  isUndoingPosting,
  onCreateCounterparty,
  onMatchInvoice,
  onMatchSupplierInvoice,
  onPostBankFee,
  onLinkCounterparty,
  onLinkedPartyChange,
  onUndoPosting
}: {
  bankAccountName: string;
  bankTransaction: BankTransaction;
  canCreateCounterparty: boolean;
  counterpartyExists: boolean;
  isLinkingCounterparty: boolean;
  isCreatingCounterparty: boolean;
  linkedPartyId: string;
  parties: Extract<AppDataState, { state: "ready" }>["parties"];
  suggestedPartyId?: string;
  suggestedInvoice: Extract<AppDataState, { state: "ready" }>["invoices"][number] | null;
  suggestedSupplierInvoice:
    | Extract<AppDataState, { state: "ready" }>["supplierInvoices"][number]
    | null;
  isMatchingInvoice: boolean;
  isMatchingSupplierInvoice: boolean;
  isPostingBankFee: boolean;
  isUndoingPosting: boolean;
  onCreateCounterparty: () => void;
  onMatchInvoice: (invoiceId: string) => void;
  onMatchSupplierInvoice: (supplierInvoiceId: string) => void;
  onPostBankFee: () => void;
  onLinkCounterparty: () => void;
  onLinkedPartyChange: (partyId: string) => void;
  onUndoPosting: () => void;
}) {
  const linkedParty = parties.find((party) => party.id === bankTransaction.partyId);
  const details = [
    ["Bank account", bankAccountName],
    ["Linked counterparty", linkedParty?.name],
    ["Booking date", bankTransaction.bookingDate],
    ["Value date", bankTransaction.valueDate],
    ["Amount", `${bankTransaction.amount} ${bankTransaction.currency}`],
    ["Status", bankTransaction.status],
    ["Description", bankTransaction.description],
    ["Reference", bankTransaction.reference],
    ["Statement counterparty", bankTransaction.counterpartyName],
    ["Statement counterparty IBAN", bankTransaction.counterpartyIban],
    ["Remittance", bankTransaction.remittanceInformation],
    ["Bank reference", bankTransaction.bankReference],
    ["Entry reference", bankTransaction.entryReference],
    ["Import source", bankTransaction.importSource],
    ["External ID", bankTransaction.externalId]
  ].filter(([, value]) => Boolean(value));

  return (
    <div className="transaction-detail-panel">
      <div className="subsection-header">
        <div>
          <h3>Selected transaction details</h3>
          <p>Bank statement data is shown as read-only text for copying.</p>
        </div>
      </div>
      <dl className="copyable-details">
        {details.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {bankTransaction.importSource ? (
        <div className="transaction-detail-actions">
          <label className="inline-select">
            <span>Link counterparty</span>
            <select
              value={linkedPartyId}
              disabled={bankTransaction.status !== "unmatched" || isLinkingCounterparty}
              onChange={(event) => onLinkedPartyChange(event.target.value)}
            >
              <option value="">No linked counterparty</option>
              {parties
                .filter((party) => party.active)
                .map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.name}
                    {party.iban ? ` · ${party.iban}` : ""}
                  </option>
                ))}
            </select>
          </label>
          <button
            className="secondary-button"
            type="button"
            disabled={bankTransaction.status !== "unmatched" || isLinkingCounterparty}
            onClick={onLinkCounterparty}
          >
            {isLinkingCounterparty ? "Linking" : "Link counterparty"}
          </button>
          {suggestedPartyId && !bankTransaction.partyId ? (
            <p className="field-note">
              Suggested by matching statement counterparty name or IBAN.
            </p>
          ) : null}
        </div>
      ) : null}
      {suggestedInvoice ? (
        <div className="transaction-detail-actions">
          <p className="field-note">
            Suggested invoice: {suggestedInvoice.number} · {suggestedInvoice.total}{" "}
            {suggestedInvoice.currency}
          </p>
          <button
            className="secondary-button"
            type="button"
            disabled={isMatchingInvoice}
            onClick={() => onMatchInvoice(suggestedInvoice.id)}
          >
            {isMatchingInvoice ? "Matching invoice" : "Match invoice"}
          </button>
        </div>
      ) : null}
      {suggestedSupplierInvoice ? (
        <div className="transaction-detail-actions">
          <p className="field-note">
            Suggested supplier invoice: {suggestedSupplierInvoice.number} ·{" "}
            {suggestedSupplierInvoice.total} {suggestedSupplierInvoice.currency}
          </p>
          <button
            className="secondary-button"
            type="button"
            disabled={isMatchingSupplierInvoice}
            onClick={() => onMatchSupplierInvoice(suggestedSupplierInvoice.id)}
          >
            {isMatchingSupplierInvoice
              ? "Matching supplier invoice"
              : "Match supplier invoice"}
          </button>
        </div>
      ) : null}
      <div className="transaction-detail-actions">
        {bankTransaction.status === "unmatched" && bankTransaction.amount.startsWith("-") ? (
          <button
            className="secondary-button"
            type="button"
            disabled={isPostingBankFee}
            onClick={onPostBankFee}
          >
            {isPostingBankFee ? "Posting bank fee" : "Post as bank fee"}
          </button>
        ) : null}
        {bankTransaction.status !== "unmatched" ? (
          <button
            className="secondary-button"
            type="button"
            disabled={isUndoingPosting}
            onClick={onUndoPosting}
          >
            {isUndoingPosting ? "Undoing" : "Undo posting"}
          </button>
        ) : null}
      </div>
      {bankTransaction.importSource && bankTransaction.counterpartyName ? (
        <div className="transaction-detail-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={!canCreateCounterparty || isCreatingCounterparty}
            onClick={onCreateCounterparty}
          >
            {isCreatingCounterparty ? "Creating counterparty" : "Create counterparty"}
          </button>
          {counterpartyExists ? (
            <p className="field-note">A counterparty with this name or IBAN already exists.</p>
          ) : null}
        </div>
      ) : null}
    </div>
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
  const [actionState, setActionState] = useState<
    "idle" | "saving" | "updating" | "deleting" | "paying" | "undo"
  >("idle");
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
  const linkedInvoiceBankTransaction = selectedInvoice
    ? data.bankTransactions.find(
        (bankTransaction) =>
          bankTransaction.matchedDocumentType === "invoice" &&
          bankTransaction.matchedDocumentId === selectedInvoice.id
      ) ?? null
    : null;
  const selectedIncomingBankTransactionId =
    selectedPaymentBankTransactionId || incomingBankTransactions[0]?.id || "";
  const [editPartyId, setEditPartyId] = useState(selectedInvoice?.partyId ?? "");
  const [editNumber, setEditNumber] = useState(selectedInvoice?.number ?? "");
  const [editIssueDate, setEditIssueDate] = useState(selectedInvoice?.issueDate ?? "");
  const [editTotal, setEditTotal] = useState(selectedInvoice?.total ?? "");

  useEffect(() => {
    if (!selectedInvoice) return;

    setEditPartyId(selectedInvoice.partyId);
    setEditNumber(selectedInvoice.number);
    setEditIssueDate(selectedInvoice.issueDate);
    setEditTotal(selectedInvoice.total);
  }, [selectedInvoice]);

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

  async function handleUndoPayment() {
    if (!linkedInvoiceBankTransaction) return;

    setActionState("undo");
    setErrorMessage(null);

    try {
      const overview = await undoBankTransactionPosting(linkedInvoiceBankTransaction.id);

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedInvoiceId(selectedInvoice?.id ?? "");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Payment was not undone.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleUpdateInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedInvoice) return;

    setActionState("updating");
    setErrorMessage(null);

    try {
      const overview = await updateSalesInvoice({
        invoiceId: selectedInvoice.id,
        partyId: editPartyId,
        number: editNumber,
        issueDate: editIssueDate,
        total: editTotal
      });

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedInvoiceId(selectedInvoice.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Invoice was not updated.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleDeleteInvoice() {
    if (!selectedInvoice) return;

    setActionState("deleting");
    setErrorMessage(null);

    try {
      const overview = await deleteSalesInvoice(selectedInvoice.id);

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedInvoiceId(overview.latestInvoice?.id ?? "");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Invoice was not deleted.");
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
          <form className="invoice-form" onSubmit={(event) => void handleUpdateInvoice(event)}>
            <label>
              <span>Edit customer</span>
              <select
                value={editPartyId}
                disabled={selectedInvoice.status === "paid"}
                onChange={(event) => setEditPartyId(event.target.value)}
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
                <span>Edit number</span>
                <input
                  value={editNumber}
                  disabled={selectedInvoice.status === "paid"}
                  onChange={(event) => setEditNumber(event.target.value)}
                />
              </label>
              <label>
                <span>Edit issue date</span>
                <input
                  type="date"
                  value={editIssueDate}
                  disabled={selectedInvoice.status === "paid"}
                  onChange={(event) => setEditIssueDate(event.target.value)}
                />
              </label>
            </div>
            <label>
              <span>Edit total</span>
              <input
                inputMode="decimal"
                value={editTotal}
                disabled={selectedInvoice.status === "paid"}
                onChange={(event) => setEditTotal(event.target.value)}
              />
            </label>
            {selectedInvoice.status === "paid" ? (
              <p className="field-note">Paid invoices cannot be edited. Undo payment first.</p>
            ) : null}
            <div className="transaction-detail-actions">
              <button
                className="secondary-button"
                type="submit"
                disabled={actionState !== "idle" || selectedInvoice.status === "paid"}
              >
                {actionState === "updating" ? "Saving invoice" : "Save invoice"}
              </button>
              <button
                className="secondary-button danger-button"
                type="button"
                disabled={actionState !== "idle" || selectedInvoice.status === "paid"}
                onClick={() => void handleDeleteInvoice()}
              >
                {actionState === "deleting" ? "Deleting invoice" : "Delete invoice"}
              </button>
            </div>
          </form>
          {linkedInvoiceBankTransaction ? (
            <LinkedBankTransactionSummary
              label="Linked incoming bank transaction"
              bankTransaction={linkedInvoiceBankTransaction}
              onUndo={() => void handleUndoPayment()}
              undoDisabled={actionState !== "idle"}
              undoLabel={actionState === "undo" ? "Undoing payment" : "Undo payment"}
            />
          ) : (
            <>
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
            </>
          )}
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
  const [actionState, setActionState] = useState<
    "idle" | "saving" | "updating" | "deleting" | "paying" | "undo"
  >("idle");
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
  const linkedSupplierBankTransaction = selectedSupplierInvoice
    ? data.bankTransactions.find(
        (bankTransaction) =>
          bankTransaction.matchedDocumentType === "supplier_invoice" &&
          bankTransaction.matchedDocumentId === selectedSupplierInvoice.id
      ) ?? null
    : null;
  const selectedOutgoingBankTransactionId =
    selectedSupplierPaymentBankTransactionId || outgoingBankTransactions[0]?.id || "";
  const [editPartyId, setEditPartyId] = useState(selectedSupplierInvoice?.partyId ?? "");
  const [editNumber, setEditNumber] = useState(selectedSupplierInvoice?.number ?? "");
  const [editIssueDate, setEditIssueDate] = useState(
    selectedSupplierInvoice?.issueDate ?? ""
  );
  const [editTotal, setEditTotal] = useState(selectedSupplierInvoice?.total ?? "");
  const [editExpenseAccountCode, setEditExpenseAccountCode] = useState(
    selectedSupplierInvoice?.expenseAccountCode ?? "4100"
  );

  useEffect(() => {
    if (!selectedSupplierInvoice) return;

    setEditPartyId(selectedSupplierInvoice.partyId);
    setEditNumber(selectedSupplierInvoice.number);
    setEditIssueDate(selectedSupplierInvoice.issueDate);
    setEditTotal(selectedSupplierInvoice.total);
    setEditExpenseAccountCode(selectedSupplierInvoice.expenseAccountCode);
  }, [selectedSupplierInvoice]);

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

  async function handleUndoSupplierPayment() {
    if (!linkedSupplierBankTransaction) return;

    setActionState("undo");
    setErrorMessage(null);

    try {
      const overview = await undoBankTransactionPosting(linkedSupplierBankTransaction.id);

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedSupplierInvoiceId(selectedSupplierInvoice?.id ?? "");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Supplier payment was not undone."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleUpdateSupplierInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedSupplierInvoice) return;

    setActionState("updating");
    setErrorMessage(null);

    try {
      const overview = await updateSupplierInvoice({
        supplierInvoiceId: selectedSupplierInvoice.id,
        partyId: editPartyId,
        number: editNumber,
        issueDate: editIssueDate,
        total: editTotal,
        expenseAccountCode: editExpenseAccountCode
      });

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedSupplierInvoiceId(selectedSupplierInvoice.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Supplier invoice was not updated."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleDeleteSupplierInvoice() {
    if (!selectedSupplierInvoice) return;

    setActionState("deleting");
    setErrorMessage(null);

    try {
      const overview = await deleteSupplierInvoice(selectedSupplierInvoice.id);

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedSupplierInvoiceId(overview.latestSupplierInvoice?.id ?? "");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Supplier invoice was not deleted."
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
          <form
            className="invoice-form"
            onSubmit={(event) => void handleUpdateSupplierInvoice(event)}
          >
            <label>
              <span>Edit supplier</span>
              <select
                value={editPartyId}
                disabled={selectedSupplierInvoice.status === "paid"}
                onChange={(event) => setEditPartyId(event.target.value)}
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
                <span>Edit number</span>
                <input
                  value={editNumber}
                  disabled={selectedSupplierInvoice.status === "paid"}
                  onChange={(event) => setEditNumber(event.target.value)}
                />
              </label>
              <label>
                <span>Edit issue date</span>
                <input
                  type="date"
                  value={editIssueDate}
                  disabled={selectedSupplierInvoice.status === "paid"}
                  onChange={(event) => setEditIssueDate(event.target.value)}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                <span>Edit total</span>
                <input
                  inputMode="decimal"
                  value={editTotal}
                  disabled={selectedSupplierInvoice.status === "paid"}
                  onChange={(event) => setEditTotal(event.target.value)}
                />
              </label>
              <label>
                <span>Edit expense account</span>
                <input
                  value={editExpenseAccountCode}
                  disabled={selectedSupplierInvoice.status === "paid"}
                  onChange={(event) => setEditExpenseAccountCode(event.target.value)}
                />
              </label>
            </div>
            {selectedSupplierInvoice.status === "paid" ? (
              <p className="field-note">
                Paid supplier invoices cannot be edited. Undo payment first.
              </p>
            ) : null}
            <div className="transaction-detail-actions">
              <button
                className="secondary-button"
                type="submit"
                disabled={actionState !== "idle" || selectedSupplierInvoice.status === "paid"}
              >
                {actionState === "updating"
                  ? "Saving supplier invoice"
                  : "Save supplier invoice"}
              </button>
              <button
                className="secondary-button danger-button"
                type="button"
                disabled={actionState !== "idle" || selectedSupplierInvoice.status === "paid"}
                onClick={() => void handleDeleteSupplierInvoice()}
              >
                {actionState === "deleting"
                  ? "Deleting supplier invoice"
                  : "Delete supplier invoice"}
              </button>
            </div>
          </form>
          {linkedSupplierBankTransaction ? (
            <LinkedBankTransactionSummary
              label="Linked outgoing bank transaction"
              bankTransaction={linkedSupplierBankTransaction}
              onUndo={() => void handleUndoSupplierPayment()}
              undoDisabled={actionState !== "idle"}
              undoLabel={
                actionState === "undo" ? "Undoing supplier payment" : "Undo supplier payment"
              }
            />
          ) : (
            <>
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
            </>
          )}
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

function LinkedBankTransactionSummary({
  bankTransaction,
  label,
  onUndo,
  undoDisabled,
  undoLabel
}: {
  bankTransaction: BankTransaction;
  label: string;
  onUndo: () => void;
  undoDisabled: boolean;
  undoLabel: string;
}) {
  return (
    <div className="linked-entries">
      <strong>{label}</strong>
      <div className="linked-entry">
        <span>
          {bankTransaction.bookingDate} · {bankTransaction.amount}{" "}
          {bankTransaction.currency}
        </span>
        <small>{bankTransaction.description}</small>
      </div>
      <button
        className="secondary-button"
        type="button"
        disabled={undoDisabled}
        onClick={onUndo}
      >
        {undoLabel}
      </button>
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
