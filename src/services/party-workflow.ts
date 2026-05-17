import type { Party, PartyRole, PartyType } from "../domain";
import { db, type SpbookDatabase } from "../storage/db";
import {
  getInvoicesByWorkspaceId,
  getPartyById,
  getSupplierInvoicesByWorkspaceId,
  saveParty
} from "../storage/repositories";
import { isValidIban } from "../shared/lib/iban";
import { loadWorkspaceOverview } from "./workspace-overview";

export type CreatePartyInput = {
  workspaceId: string;
  name: string;
  type: PartyType;
  roles: PartyRole[];
  countryCode?: string;
  registrationNumber?: string;
  vatId?: string;
  iban?: string;
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  city?: string;
  region?: string;
  contactName?: string;
  email?: string;
  active?: boolean;
};

export type UpdatePartyInput = {
  partyId: string;
  name: string;
  type: PartyType;
  roles: PartyRole[];
  countryCode?: string;
  registrationNumber?: string;
  vatId?: string;
  iban?: string;
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  city?: string;
  region?: string;
  contactName?: string;
  email?: string;
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
    registrationNumber: normalizeOptional(input.registrationNumber),
    vatId: normalizeOptional(input.vatId),
    iban: normalizeIban(input.iban),
    addressLine1: normalizeOptional(input.addressLine1),
    addressLine2: normalizeOptional(input.addressLine2),
    postalCode: normalizeOptional(input.postalCode),
    city: normalizeOptional(input.city),
    region: normalizeOptional(input.region),
    contactName: normalizeOptional(input.contactName),
    email: normalizeEmail(input.email),
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
    registrationNumber: normalizeOptional(input.registrationNumber),
    vatId: normalizeOptional(input.vatId),
    iban: normalizeIban(input.iban),
    addressLine1: normalizeOptional(input.addressLine1),
    addressLine2: normalizeOptional(input.addressLine2),
    postalCode: normalizeOptional(input.postalCode),
    city: normalizeOptional(input.city),
    region: normalizeOptional(input.region),
    contactName: normalizeOptional(input.contactName),
    email: normalizeEmail(input.email),
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

  if (party.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(party.email)) {
    throw new Error("Party email is invalid.");
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

function normalizeEmail(value: string | undefined) {
  return normalizeOptional(value)?.toLowerCase();
}

function normalizeIban(value: string | undefined) {
  const normalized = value?.replace(/\s+/g, "").toUpperCase();

  if (!normalized) {
    return undefined;
  }

  if (!isValidIban(normalized)) {
    throw new Error("IBAN is invalid.");
  }

  return normalized;
}

function createEntityId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}
