import type { Party, PartyRole } from "./types";

export function getPartyById(parties: Party[], id: string) {
  return parties.find((party) => party.id === id) ?? null;
}

export function partyHasRole(party: Party, role: PartyRole) {
  return party.roles.includes(role);
}
