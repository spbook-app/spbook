import { useEffect, useState, type FormEvent } from "react";
import type { PartyRole, PartyType } from "../../domain";
import type { AppDataState } from "../../app/App";
import { isValidIban } from "../../services/bank-workflow";
import { createParty, updateParty } from "../../services/party-workflow";
import { mapOverviewToReadyState } from "../../shared/lib/workspace-overview";

const partyRoles: PartyRole[] = ["customer", "supplier", "tax_authority", "bank", "owner"];

export function CounterpartiesPanel({
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
