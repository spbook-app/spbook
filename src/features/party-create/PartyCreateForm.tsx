import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { AppDataState } from "../../app/App";
import {
  emptyPartyForm,
  PartyEditableFields,
  type PartyFormState
} from "../../entities/party/PartyFields";
import { createParty } from "../../services/party-workflow";
import { getIbanValidationMessage } from "../../shared/lib/iban";
import { mapOverviewToReadyState } from "../../shared/lib/workspace-overview";

type ReadyAppData = Extract<AppDataState, { state: "ready" }>;

export function PartyCreateForm({
  data,
  onDataStateChange
}: {
  data: ReadyAppData;
  onDataStateChange: (state: AppDataState) => void;
}) {
  const navigate = useNavigate();
  const [formState, setFormState] = useState<PartyFormState>(emptyPartyForm);
  const [actionState, setActionState] = useState<"idle" | "saving">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const ibanValidationMessage = getIbanValidationMessage(formState.iban);

  async function handleCreateParty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionState("saving");
    setErrorMessage(null);

    try {
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
        email: formState.email,
        active: true
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
      setErrorMessage(
        error instanceof Error ? error.message : "Counterparty was not created."
      );
    } finally {
      setActionState("idle");
    }
  }

  return (
    <section className="panel" aria-labelledby="create-party-title">
      <div className="panel-header">
        <h2 id="create-party-title">Add counterparty</h2>
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
          {actionState === "saving" ? "Adding" : "Add counterparty"}
        </button>
      </form>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </section>
  );
}
