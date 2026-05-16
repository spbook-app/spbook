import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { AppDataState } from "../../app/App";
import type { Party, PartyRole, PartyType } from "../../domain";
import { isValidIban } from "../../services/bank-workflow";
import { createParty, updateParty } from "../../services/party-workflow";
import { mapOverviewToReadyState } from "../../shared/lib/workspace-overview";

const partyRoles: PartyRole[] = ["customer", "supplier", "tax_authority", "bank", "owner"];

type ReadyAppData = Extract<AppDataState, { state: "ready" }>;
type CounterpartyRoute =
  | { mode: "list" }
  | { mode: "create" }
  | { mode: "detail"; partyId: string }
  | { mode: "edit"; partyId: string };

type PartyFormState = {
  name: string;
  type: PartyType;
  roles: PartyRole[];
  countryCode: string;
  registrationNumber: string;
  vatId: string;
  iban: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  region: string;
  contactName: string;
  email: string;
  active: boolean;
};

const emptyPartyForm: PartyFormState = {
  name: "",
  type: "business",
  roles: ["customer"],
  countryCode: "SI",
  registrationNumber: "",
  vatId: "",
  iban: "",
  addressLine1: "",
  addressLine2: "",
  postalCode: "",
  city: "",
  region: "",
  contactName: "",
  email: "",
  active: true
};

export function CounterpartiesView({
  data,
  onDataStateChange
}: {
  data: ReadyAppData;
  onDataStateChange: (state: AppDataState) => void;
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname
  });
  const route = getCounterpartyRoute(pathname);

  if (route.mode === "create") {
    return <CounterpartyCreatePage data={data} onDataStateChange={onDataStateChange} />;
  }

  if (route.mode === "detail" || route.mode === "edit") {
    const party = data.parties.find((candidate) => candidate.id === route.partyId) ?? null;

    if (!party) {
      return <CounterpartyNotFound partyId={route.partyId} />;
    }

    return (
      <CounterpartyDetailPage
        data={data}
        mode={route.mode}
        onDataStateChange={onDataStateChange}
        party={party}
      />
    );
  }

  return <CounterpartyListPage data={data} />;
}

function CounterpartyListPage({ data }: { data: ReadyAppData }) {
  return (
    <section className="panel panel-wide" aria-labelledby="counterparties-title">
      <div className="panel-header">
        <h2 id="counterparties-title">Counterparties</h2>
        <Link className="primary-button" to="/workspace/counterparties/new">
          Create counterparty
        </Link>
      </div>

      <div className="party-list">
        {data.parties.length === 0 ? <p className="empty-state">No counterparties yet.</p> : null}
        {data.parties.map((party) => (
          <Link
            className="party-row"
            key={party.id}
            to="/workspace/counterparties/$partyId"
            params={{ partyId: party.id }}
          >
            <div>
              <strong>{party.name}</strong>
              <span>{formatPartySummary(party)}</span>
            </div>
            <div className="role-list">
              {party.roles.map((role) => (
                <span className="role-pill role-posting" key={`${party.id}-${role}`}>
                  {role}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function CounterpartyCreatePage({
  data,
  onDataStateChange
}: {
  data: ReadyAppData;
  onDataStateChange: (state: AppDataState) => void;
}) {
  const navigate = useNavigate();
  const [formState, setFormState] = useState<PartyFormState>({
    ...emptyPartyForm,
    name: "ACME d.o.o."
  });
  const [actionState, setActionState] = useState<"idle" | "saving">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const ibanValidationMessage = getIbanValidationMessage(formState.iban);

  async function handleCreateParty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionState("saving");
    setErrorMessage(null);

    try {
      if (ibanValidationMessage) {
        throw new Error(ibanValidationMessage);
      }

      const overview = await createParty({
        workspaceId: data.workspace.id,
        name: formState.name,
        type: formState.type,
        roles: formState.roles,
        countryCode: formState.countryCode,
        registrationNumber: formState.registrationNumber,
        vatId: formState.vatId,
        iban: formState.iban,
        addressLine1: formState.addressLine1,
        addressLine2: formState.addressLine2,
        postalCode: formState.postalCode,
        city: formState.city,
        region: formState.region,
        contactName: formState.contactName,
        email: formState.email
      });
      const createdParty = overview.parties.at(-1);

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });

      if (createdParty) {
        void navigate({
          to: "/workspace/counterparties/$partyId",
          params: { partyId: createdParty.id }
        });
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Party was not created.");
    } finally {
      setActionState("idle");
    }
  }

  return (
    <section className="panel panel-wide" aria-labelledby="create-counterparty-title">
      <div className="panel-header">
        <h2 id="create-counterparty-title">Create counterparty</h2>
        <Link className="secondary-button" to="/workspace/counterparties">
          Back to list
        </Link>
      </div>

      <form className="invoice-form" onSubmit={(event) => void handleCreateParty(event)}>
        <PartyEditableFields
          formState={formState}
          ibanValidationMessage={ibanValidationMessage}
          onFormStateChange={setFormState}
        />
        <button className="primary-button" type="submit" disabled={actionState !== "idle"}>
          {actionState === "saving" ? "Creating" : "Create counterparty"}
        </button>
      </form>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </section>
  );
}

function CounterpartyDetailPage({
  data,
  mode,
  onDataStateChange,
  party
}: {
  data: ReadyAppData;
  mode: "detail" | "edit";
  onDataStateChange: (state: AppDataState) => void;
  party: Party;
}) {
  const navigate = useNavigate();
  const [formState, setFormState] = useState<PartyFormState>(() => mapPartyToFormState(party));
  const [actionState, setActionState] = useState<"idle" | "updating">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const ibanValidationMessage = getIbanValidationMessage(formState.iban);
  const issuedInvoices = data.invoices.filter((invoice) => invoice.partyId === party.id);
  const supplierInvoices = data.supplierInvoices.filter(
    (supplierInvoice) => supplierInvoice.partyId === party.id
  );
  const bankTransactions = data.bankTransactions.filter(
    (bankTransaction) => bankTransaction.partyId === party.id
  );
  const bankAccounts = data.bankAccounts.filter((bankAccount) => bankAccount.partyId === party.id);

  useEffect(() => {
    setFormState(mapPartyToFormState(party));
  }, [party]);

  async function handleUpdateParty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionState("updating");
    setErrorMessage(null);

    try {
      if (ibanValidationMessage) {
        throw new Error(ibanValidationMessage);
      }

      const overview = await updateParty({
        partyId: party.id,
        name: formState.name,
        type: formState.type,
        roles: formState.roles,
        countryCode: formState.countryCode,
        registrationNumber: formState.registrationNumber,
        vatId: formState.vatId,
        iban: formState.iban,
        addressLine1: formState.addressLine1,
        addressLine2: formState.addressLine2,
        postalCode: formState.postalCode,
        city: formState.city,
        region: formState.region,
        contactName: formState.contactName,
        email: formState.email,
        active: formState.active
      });

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      void navigate({
        to: "/workspace/counterparties/$partyId",
        params: { partyId: party.id }
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Party was not updated.");
    } finally {
      setActionState("idle");
    }
  }

  return (
    <section className="panel panel-wide" aria-labelledby="counterparty-detail-title">
      <div className="panel-header">
        <h2 id="counterparty-detail-title">{party.name}</h2>
        <span className="status-pill">{party.active ? "active" : "inactive"}</span>
      </div>

      <div className="transaction-detail-actions">
        <Link className="secondary-button" to="/workspace/counterparties">
          Back to list
        </Link>
        {mode === "detail" ? (
          <Link
            className="secondary-button"
            to="/workspace/counterparties/$partyId/edit"
            params={{ partyId: party.id }}
          >
            Edit counterparty
          </Link>
        ) : null}
      </div>

      {mode === "edit" ? (
        <form className="invoice-form" onSubmit={(event) => void handleUpdateParty(event)}>
          <PartyEditableFields
            formState={formState}
            ibanValidationMessage={ibanValidationMessage}
            onFormStateChange={setFormState}
            showActive
          />
          <div className="transaction-detail-actions">
            <button className="primary-button" type="submit" disabled={actionState !== "idle"}>
              {actionState === "updating" ? "Saving" : "Save counterparty"}
            </button>
            <Link
              className="secondary-button"
              to="/workspace/counterparties/$partyId"
              params={{ partyId: party.id }}
            >
              Cancel
            </Link>
          </div>
        </form>
      ) : (
        <>
          <CounterpartyDetails party={party} />
          <RelatedCounterpartyRecords
            bankAccounts={bankAccounts}
            bankTransactions={bankTransactions}
            issuedInvoices={issuedInvoices}
            supplierInvoices={supplierInvoices}
          />
        </>
      )}

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </section>
  );
}

function PartyEditableFields({
  formState,
  ibanValidationMessage,
  onFormStateChange,
  showActive = false
}: {
  formState: PartyFormState;
  ibanValidationMessage: string | null;
  onFormStateChange: (state: PartyFormState) => void;
  showActive?: boolean;
}) {
  function updateFormState(update: Partial<PartyFormState>) {
    onFormStateChange({ ...formState, ...update });
  }

  function toggleRole(role: PartyRole) {
    const roles = formState.roles.includes(role)
      ? formState.roles.filter((currentRole) => currentRole !== role)
      : [...formState.roles, role];

    updateFormState({ roles });
  }

  return (
    <>
      <div className="form-row">
        <label>
          <span>Name</span>
          <input
            required
            value={formState.name}
            onChange={(event) => updateFormState({ name: event.target.value })}
          />
        </label>
        <label>
          <span>Type</span>
          <select
            value={formState.type}
            onChange={(event) => updateFormState({ type: event.target.value as PartyType })}
          >
            <option value="business">Business</option>
            <option value="person">Person</option>
            <option value="government">Government</option>
          </select>
        </label>
      </div>
      <div className="form-row">
        <label>
          <span>Country</span>
          <input
            value={formState.countryCode}
            onChange={(event) => updateFormState({ countryCode: event.target.value })}
          />
        </label>
        <label>
          <span>VAT ID</span>
          <input
            value={formState.vatId}
            onChange={(event) => updateFormState({ vatId: event.target.value })}
          />
        </label>
      </div>
      <label>
        <span>Registration number</span>
        <input
          value={formState.registrationNumber}
          onChange={(event) => updateFormState({ registrationNumber: event.target.value })}
        />
      </label>
      <label>
        <span>IBAN</span>
        <input
          aria-invalid={ibanValidationMessage ? "true" : "false"}
          placeholder="SI56 1910 0000 0123 438"
          value={formState.iban}
          onChange={(event) => updateFormState({ iban: event.target.value })}
        />
      </label>
      {ibanValidationMessage ? <p className="field-error">{ibanValidationMessage}</p> : null}
      <div className="form-row">
        <label>
          <span>Address line 1</span>
          <input
            value={formState.addressLine1}
            onChange={(event) => updateFormState({ addressLine1: event.target.value })}
          />
        </label>
        <label>
          <span>Address line 2</span>
          <input
            value={formState.addressLine2}
            onChange={(event) => updateFormState({ addressLine2: event.target.value })}
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          <span>Postal code</span>
          <input
            value={formState.postalCode}
            onChange={(event) => updateFormState({ postalCode: event.target.value })}
          />
        </label>
        <label>
          <span>City</span>
          <input
            value={formState.city}
            onChange={(event) => updateFormState({ city: event.target.value })}
          />
        </label>
      </div>
      <label>
        <span>Region / county</span>
        <input
          value={formState.region}
          onChange={(event) => updateFormState({ region: event.target.value })}
        />
      </label>
      <div className="form-row">
        <label>
          <span>Contact name</span>
          <input
            value={formState.contactName}
            onChange={(event) => updateFormState({ contactName: event.target.value })}
          />
        </label>
        <label>
          <span>Email</span>
          <input
            type="email"
            value={formState.email}
            onChange={(event) => updateFormState({ email: event.target.value })}
          />
        </label>
      </div>
      <div className="role-picker" aria-label="Party roles">
        {partyRoles.map((role) => (
          <label key={role}>
            <input
              type="checkbox"
              checked={formState.roles.includes(role)}
              onChange={() => toggleRole(role)}
            />
            <span>{role}</span>
          </label>
        ))}
      </div>
      {showActive ? (
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={formState.active}
            onChange={(event) => updateFormState({ active: event.target.checked })}
          />
          <span>Active counterparty</span>
        </label>
      ) : null}
    </>
  );
}

function CounterpartyDetails({ party }: { party: Party }) {
  return (
    <dl className="detail-list copyable-details">
      <div>
        <dt>Name</dt>
        <dd>{party.name}</dd>
      </div>
      <div>
        <dt>Type</dt>
        <dd>{party.type}</dd>
      </div>
      <div>
        <dt>Roles</dt>
        <dd>{party.roles.join(", ")}</dd>
      </div>
      <div>
        <dt>Country</dt>
        <dd>{party.countryCode ?? "-"}</dd>
      </div>
      <div>
        <dt>Registration number</dt>
        <dd>{party.registrationNumber ?? "-"}</dd>
      </div>
      <div>
        <dt>VAT ID</dt>
        <dd>{party.vatId ?? "-"}</dd>
      </div>
      <div>
        <dt>IBAN</dt>
        <dd>{party.iban ?? "-"}</dd>
      </div>
      <div>
        <dt>Address</dt>
        <dd>{formatPartyAddress(party) || "-"}</dd>
      </div>
      <div>
        <dt>Contact</dt>
        <dd>{[party.contactName, party.email].filter(Boolean).join(" · ") || "-"}</dd>
      </div>
    </dl>
  );
}

function RelatedCounterpartyRecords({
  bankAccounts,
  bankTransactions,
  issuedInvoices,
  supplierInvoices
}: {
  bankAccounts: ReadyAppData["bankAccounts"];
  bankTransactions: ReadyAppData["bankTransactions"];
  issuedInvoices: ReadyAppData["invoices"];
  supplierInvoices: ReadyAppData["supplierInvoices"];
}) {
  return (
    <div className="linked-entries">
      <strong>Related records</strong>
      {issuedInvoices.length === 0 &&
      supplierInvoices.length === 0 &&
      bankAccounts.length === 0 &&
      bankTransactions.length === 0 ? (
        <p className="empty-state">No related records yet.</p>
      ) : null}
      {issuedInvoices.map((invoice) => (
        <Link
          className="linked-entry"
          key={invoice.id}
          to="/workspace/sales/invoices/$invoiceId"
          params={{ invoiceId: invoice.id }}
        >
          <span>Issued invoice {invoice.number}</span>
          <small>
            {invoice.issueDate} · {invoice.total} {invoice.currency} · {invoice.status}
          </small>
        </Link>
      ))}
      {supplierInvoices.map((supplierInvoice) => (
        <div className="linked-entry" key={supplierInvoice.id}>
          <span>Supplier invoice {supplierInvoice.number}</span>
          <small>
            {supplierInvoice.issueDate} · {supplierInvoice.total}{" "}
            {supplierInvoice.currency} · {supplierInvoice.status}
          </small>
        </div>
      ))}
      {bankAccounts.map((bankAccount) => (
        <div className="linked-entry" key={bankAccount.id}>
          <span>Bank account {bankAccount.name}</span>
          <small>
            {bankAccount.iban ?? "No IBAN"} · {bankAccount.currency}
          </small>
        </div>
      ))}
      {bankTransactions.map((bankTransaction) => (
        <Link
          className="linked-entry"
          key={bankTransaction.id}
          to="/workspace/banking/transactions/$bankTransactionId"
          params={{ bankTransactionId: bankTransaction.id }}
        >
          <span>Bank transaction {bankTransaction.bookingDate}</span>
          <small>
            {bankTransaction.amount} {bankTransaction.currency} ·{" "}
            {bankTransaction.description}
          </small>
        </Link>
      ))}
    </div>
  );
}

function CounterpartyNotFound({ partyId }: { partyId: string }) {
  return (
    <section className="panel" aria-labelledby="counterparty-not-found-title">
      <div className="panel-header">
        <h2 id="counterparty-not-found-title">Counterparty not found</h2>
        <Link className="secondary-button" to="/workspace/counterparties">
          Back to list
        </Link>
      </div>
      <p className="empty-state">Counterparty "{partyId}" does not exist in this workspace.</p>
    </section>
  );
}

function getCounterpartyRoute(pathname: string): CounterpartyRoute {
  const [, workspace, counterparties, partyId, mode] = pathname.split("/");

  if (workspace !== "workspace" || counterparties !== "counterparties") {
    return { mode: "list" };
  }

  if (!partyId) {
    return { mode: "list" };
  }

  if (partyId === "new") {
    return { mode: "create" };
  }

  if (mode === "edit") {
    return { mode: "edit", partyId };
  }

  return { mode: "detail", partyId };
}

function mapPartyToFormState(party: Party): PartyFormState {
  return {
    name: party.name,
    type: party.type,
    roles: party.roles,
    countryCode: party.countryCode ?? "",
    registrationNumber: party.registrationNumber ?? "",
    vatId: party.vatId ?? "",
    iban: party.iban ?? "",
    addressLine1: party.addressLine1 ?? "",
    addressLine2: party.addressLine2 ?? "",
    postalCode: party.postalCode ?? "",
    city: party.city ?? "",
    region: party.region ?? "",
    contactName: party.contactName ?? "",
    email: party.email ?? "",
    active: party.active
  };
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

function formatPartySummary(party: Party) {
  return [
    party.type,
    party.countryCode ?? "No country",
    party.registrationNumber,
    party.vatId,
    party.iban,
    party.city,
    party.active ? undefined : "inactive"
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatPartyAddress(party: Party) {
  const locality = [party.postalCode, party.city].filter(Boolean).join(" ");

  return [
    party.addressLine1,
    party.addressLine2,
    locality || undefined,
    party.region,
    party.countryCode
  ]
    .filter(Boolean)
    .join(", ");
}
