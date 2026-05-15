import type { Party, PartyRole, PartyType } from "../domain";
import { db, type SpbookDatabase } from "../storage/db";
import {
  getInvoicesByWorkspaceId,
  getPartyById,
  getSupplierInvoicesByWorkspaceId,
  saveParty
} from "../storage/repositories";
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

export type UpdatePartyInput = {
  partyId: string;
  name: string;
  type: PartyType;
  roles: PartyRole[];
  countryCode?: string;
  vatId?: string;
  active: boolean;
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

export async function updateParty(
  input: UpdatePartyInput,
  database: SpbookDatabase = db
) {
  const existingParty = await getPartyById(input.partyId, database);

  if (!existingParty) {
    throw new Error(`Party "${input.partyId}" was not found.`);
  }

  const updatedParty: Party = {
    ...existingParty,
    name: input.name.trim(),
    countryCode: normalizeOptional(input.countryCode),
    vatId: normalizeOptional(input.vatId),
    type: input.type,
    roles: [...new Set(input.roles)],
    active: input.active
  };

  validatePartyInput(updatedParty);
  await ensureUsedPartyRoles(updatedParty, database);
  await saveParty(updatedParty, database);

  return loadWorkspaceOverview(existingParty.workspaceId, database);
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

async function ensureUsedPartyRoles(party: Party, database: SpbookDatabase) {
  const [invoices, supplierInvoices] = await Promise.all([
    getInvoicesByWorkspaceId(party.workspaceId, database),
    getSupplierInvoicesByWorkspaceId(party.workspaceId, database)
  ]);

  if (
    invoices.some((invoice) => invoice.partyId === party.id) &&
    !party.roles.includes("customer")
  ) {
    throw new Error("Party with issued invoices must keep the customer role.");
  }

  if (
    supplierInvoices.some((supplierInvoice) => supplierInvoice.partyId === party.id) &&
    !party.roles.includes("supplier")
  ) {
    throw new Error("Party with supplier invoices must keep the supplier role.");
  }
}

function normalizeOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function createEntityId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}
