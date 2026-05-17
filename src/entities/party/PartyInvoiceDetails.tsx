import type { Party } from "../../domain";

export function PartyInvoiceDetails({
  party,
  fallbackLabel
}: {
  party: Party | null;
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
