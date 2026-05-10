import type { Party, PartyRole, PartyType } from "../domain";
import { db, type SpbookDatabase } from "../storage/db";
import { saveParty } from "../storage/repositories";
import { loadWorkspaceOverview } from "./workspace-overview";

export type CreatePartyInput = {
  workspaceId: string;
  name: string;
  type: PartyType;
  roles: PartyRole[];
  countryCode?: string;
  vatId?: string;
  active?: boolean;
};

export async function createParty(
  input: CreatePartyInput,
  database: SpbookDatabase = db
) {
  const party = buildParty(input);

  validatePartyInput(party);

  await saveParty(party, database);

  return loadWorkspaceOverview(input.workspaceId, database);
}

function buildParty(input: CreatePartyInput): Party {
  return {
    id: createEntityId("party"),
    workspaceId: input.workspaceId,
    name: input.name.trim(),
    countryCode: normalizeOptional(input.countryCode),
    vatId: normalizeOptional(input.vatId),
    type: input.type,
    roles: [...new Set(input.roles)],
    active: input.active ?? true
  };
}

function validatePartyInput(party: Party) {
  if (!party.name) {
    throw new Error("Party name is required.");
  }

  if (party.roles.length === 0) {
    throw new Error("At least one party role is required.");
  }
}

function normalizeOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function createEntityId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}
