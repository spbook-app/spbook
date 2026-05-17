import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { Party } from "../../domain";
import {
  PartyEditableFields,
  type PartyFormState
} from "../../entities/party/PartyFields";
import { updateParty } from "../../services/party-workflow";
import { getIbanValidationMessage } from "../../shared/lib/iban";
import type { WorkspaceUpdateHandler } from "../../shared/model/workspace";

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

export function CounterpartyEditForm({
  party,
  onWorkspaceUpdate
}: {
  party: Party;
  onWorkspaceUpdate: WorkspaceUpdateHandler;
}) {
  const navigate = useNavigate();
  const [formState, setFormState] = useState<PartyFormState>(() => mapPartyToFormState(party));
  const [actionState, setActionState] = useState<"idle" | "updating">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const ibanValidationMessage = getIbanValidationMessage(formState.iban);

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

      onWorkspaceUpdate(update);
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
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </form>
  );
}
