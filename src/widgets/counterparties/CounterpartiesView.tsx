import { Link } from "@tanstack/react-router";
import type { WorkspaceUpdateHandler } from "../../shared/model/workspace";
import type { BankAccount, Invoice, Party, SupplierInvoice } from "../../domain";
import type { CounterpartiesViewProps } from "../../shared/model/widget-props";
import { PartyCreateForm } from "../../features/party-create/PartyCreateForm";
import { CounterpartyEditForm } from "../../features/counterparty-edit/CounterpartyEditForm";

export type CounterpartyRoute =
  | { mode: "list" }
  | { mode: "create" }
  | { mode: "workspace"; partyId: string }
  | { mode: "card"; partyId: string }
  | { mode: "edit"; partyId: string };

export function CounterpartiesView(
  props: CounterpartiesViewProps & { route: CounterpartyRoute }
) {
  const { workspace, parties, invoices, supplierInvoices, bankAccounts, onWorkspaceUpdate } =
    props;
  const { route } = props;

  if (route.mode === "create") {
    return <PartyCreateForm onWorkspaceUpdate={onWorkspaceUpdate} workspaceId={workspace.id} />;
  }

  if (route.mode === "workspace" || route.mode === "card" || route.mode === "edit") {
    const party = parties.find((candidate) => candidate.id === route.partyId) ?? null;

    if (!party) {
      return <CounterpartyNotFound partyId={route.partyId} />;
    }

    return (
      <CounterpartyDetailPage
        bankAccounts={bankAccounts}
        mode={route.mode}
        onWorkspaceUpdate={onWorkspaceUpdate}
        party={party}
      />
    );
  }

  return (
    <CounterpartyListPage
      invoices={invoices}
      parties={parties}
      supplierInvoices={supplierInvoices}
    />
  );
}

function CounterpartyListPage({
  invoices: _invoices,
  parties,
  supplierInvoices: _supplierInvoices
}: {
  invoices: Invoice[];
  parties: Party[];
  supplierInvoices: SupplierInvoice[];
}) {
  return (
    <section className="panel panel-wide" aria-labelledby="counterparties-title">
      <div className="panel-header">
        <h2 id="counterparties-title">Counterparties</h2>
        <Link className="primary-button" to="/workspace/counterparties/new">
          Create counterparty
        </Link>
      </div>

      <div className="party-list">
        {parties.length === 0 ? <p className="empty-state">No counterparties yet.</p> : null}
        {parties.map((party) => (
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
  bankAccounts,
  mode,
  onWorkspaceUpdate,
  party
}: {
  bankAccounts: BankAccount[];
  mode: "workspace" | "card" | "edit";
  onWorkspaceUpdate: WorkspaceUpdateHandler;
  party: Party;
}) {
  const relatedBankAccounts = bankAccounts.filter((bankAccount) => bankAccount.partyId === party.id);

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
        <CounterpartyEditForm party={party} onWorkspaceUpdate={onWorkspaceUpdate} />
      ) : mode === "card" || mode === "workspace" ? (
        <>
          <CounterpartyDetails party={party} />
          {relatedBankAccounts.length > 0 ? (
            <div className="document-list" aria-label="Bank accounts" style={{ marginTop: "16px" }}>
              {relatedBankAccounts.map((bankAccount) => (
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
