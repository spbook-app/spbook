import type { PartyRole, PartyType } from "../../domain";

export const partyRoles: PartyRole[] = [
  "customer",
  "supplier",
  "tax_authority",
  "bank",
  "owner"
];

export type PartyFormState = {
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

export const emptyPartyForm: PartyFormState = {
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

export function PartyEditableFields({
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
