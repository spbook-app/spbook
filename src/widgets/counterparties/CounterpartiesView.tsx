import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { AppDataState, ReadyWorkspaceData } from "../../shared/model/workspace";
import type { Party } from "../../domain";
import {
  PartyEditableFields,
  type PartyFormState
} from "../../entities/party/PartyFields";
import { PartyCreateForm } from "../../features/party-create/PartyCreateForm";
import { updateParty } from "../../services/party-workflow";
import { getIbanValidationMessage } from "../../shared/lib/iban";
import { applyWorkspaceUpdate } from "../../shared/lib/workspace-overview";

type ReadyAppData = ReadyWorkspaceData;
type CounterpartyRoute =
  | { mode: "list" }
  | { mode: "create" }
  | { mode: "workspace"; partyId: string }
  | { mode: "card"; partyId: string }
  | { mode: "edit"; partyId: string };

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
    return <PartyCreateForm data={data} onDataStateChange={onDataStateChange} />;
  }

  if (route.mode === "workspace" || route.mode === "card" || route.mode === "edit") {
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
            to="/workspace/counterparties/$partyId/card"
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

function CounterpartyDetailPage({
  data,
  mode,
  onDataStateChange,
  party
}: {
  data: ReadyAppData;
  mode: "workspace" | "card" | "edit";
  onDataStateChange: (state: AppDataState) => void;
  party: Party;
}) {
  const navigate = useNavigate();
  const [formState, setFormState] = useState<PartyFormState>(() => mapPartyToFormState(party));
  const [actionState, setActionState] = useState<"idle" | "updating">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const ibanValidationMessage = getIbanValidationMessage(formState.iban);
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

      const update = await updateParty({
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

      onDataStateChange(applyWorkspaceUpdate(data, update));
      void navigate({
        to: "/workspace/counterparties/$partyId/card",
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
        {mode === "workspace" || mode === "card" ? (
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
              to="/workspace/counterparties/$partyId/card"
              params={{ partyId: party.id }}
            >
              Cancel
            </Link>
          </div>
        </form>
      ) : mode === "card" || mode === "workspace" ? (
        <>
          <CounterpartyDetails party={party} />
          {bankAccounts.length > 0 ? (
            <div className="document-list" aria-label="Bank accounts" style={{ marginTop: "16px" }}>
              {bankAccounts.map((bankAccount) => (
                <Link
                  className="document-list-item"
                  key={bankAccount.id}
                  to="/workspace/banking/accounts/$bankAccountId"
                  params={{ bankAccountId: bankAccount.id }}
                >
                  <strong>{bankAccount.name}</strong>
                  <span>
                    {bankAccount.iban ?? "No IBAN"} · {bankAccount.currency}
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </section>
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

  if (mode === "card") {
    return { mode: "card", partyId };
  }

  return { mode: "workspace", partyId };
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
