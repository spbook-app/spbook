import type {
  Account,
  BankAccount,
  BankTransaction,
  Invoice,
  JournalEntry,
  Party,
  SupplierInvoice,
  Workspace
} from "../domain";
import { db, type SpbookDatabase } from "../storage/db";
import {
  getAccountsByWorkspaceId,
  getBankAccountsByWorkspaceId,
  getBankTransactionsByWorkspaceId,
  getFirstWorkspace,
  getInvoicesByWorkspaceId,
  getJournalEntriesByWorkspaceId,
  getPartiesByWorkspaceId,
  getSupplierInvoicesByWorkspaceId
} from "../storage/repositories";
import { calculateAccountBalances, type AccountBalance } from "./balances";

// ---------------------------------------------------------------------------
// Granular slice loaders — load only the entity groups that changed.
// Use these in workflow services instead of loadWorkspaceOverview.
// ---------------------------------------------------------------------------

export async function loadAccountsSlice(
  workspaceId: string,
  database: SpbookDatabase = db
) {
  const accounts = await getAccountsByWorkspaceId(workspaceId, database);
  return { accounts };
}

export async function loadPartiesSlice(
  workspaceId: string,
  database: SpbookDatabase = db
) {
  const parties = await getPartiesByWorkspaceId(workspaceId, database);
  return { parties };
}

export async function loadBankingSlice(
  workspaceId: string,
  database: SpbookDatabase = db
) {
  const [bankAccounts, bankTransactions] = await Promise.all([
    getBankAccountsByWorkspaceId(workspaceId, database),
    getBankTransactionsByWorkspaceId(workspaceId, database)
  ]);
  return { bankAccounts, bankTransactions };
}

export async function loadLedgerSlice(
  workspaceId: string,
  database: SpbookDatabase = db
) {
  const journalEntries = await getJournalEntriesByWorkspaceId(workspaceId, database);
  return { journalEntries, balances: calculateAccountBalances(journalEntries) };
}

/**
 * Loads the invoices slice.
 * @param selectedInvoice When provided (e.g. after create/update), this invoice
 *   is used as the `invoice` field so callers can navigate to it immediately.
 *   Falls back to the last invoice in the list.
 */
export async function loadInvoicesSlice(
  workspaceId: string,
  selectedInvoice?: Invoice,
  database: SpbookDatabase = db
) {
  const [invoices, parties] = await Promise.all([
    getInvoicesByWorkspaceId(workspaceId, database),
    getPartiesByWorkspaceId(workspaceId, database)
  ]);
  const invoice = selectedInvoice ?? invoices.at(-1) ?? null;
  const invoiceParty = invoice
    ? (parties.find((p) => p.id === invoice.partyId) ?? null)
    : null;
  return { invoices, invoice, invoiceParty };
}

/**
 * Loads the supplier invoices slice.
 * @param selectedSupplierInvoice When provided (e.g. after create/update), this
 *   supplier invoice is used as the `supplierInvoice` field.
 *   Falls back to the last supplier invoice in the list.
 */
export async function loadSupplierInvoicesSlice(
  workspaceId: string,
  selectedSupplierInvoice?: SupplierInvoice,
  database: SpbookDatabase = db
) {
  const [supplierInvoices, parties] = await Promise.all([
    getSupplierInvoicesByWorkspaceId(workspaceId, database),
    getPartiesByWorkspaceId(workspaceId, database)
  ]);
  const supplierInvoice =
    selectedSupplierInvoice ?? supplierInvoices.at(-1) ?? null;
  const supplierInvoiceParty = supplierInvoice
    ? (parties.find((p) => p.id === supplierInvoice.partyId) ?? null)
    : null;
  return { supplierInvoices, supplierInvoice, supplierInvoiceParty };
}

export type WorkspaceOverview = {
  workspace: Workspace;
  accounts: Account[];
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  parties: Party[];
  invoices: Invoice[];
  latestInvoice: Invoice | null;
  latestInvoiceParty: Party | null;
  supplierInvoices: SupplierInvoice[];
  latestSupplierInvoice: SupplierInvoice | null;
  latestSupplierInvoiceParty: Party | null;
  journalEntries: JournalEntry[];
  balances: AccountBalance[];
};

export async function loadWorkspaceOverview(
  workspaceId: string,
  database: SpbookDatabase = db
): Promise<WorkspaceOverview> {
  const workspace = await getFirstWorkspace(database);

  if (!workspace || workspace.id !== workspaceId) {
    throw new Error(`Workspace "${workspaceId}" was not found.`);
  }

  const [
    accounts,
    bankAccounts,
    bankTransactions,
    parties,
    invoices,
    supplierInvoices,
    journalEntries
  ] =
    await Promise.all([
      getAccountsByWorkspaceId(workspaceId, database),
      getBankAccountsByWorkspaceId(workspaceId, database),
      getBankTransactionsByWorkspaceId(workspaceId, database),
      getPartiesByWorkspaceId(workspaceId, database),
      getInvoicesByWorkspaceId(workspaceId, database),
      getSupplierInvoicesByWorkspaceId(workspaceId, database),
      getJournalEntriesByWorkspaceId(workspaceId, database)
    ]);
  const latestInvoice = invoices.at(-1) ?? null;
  const latestSupplierInvoice = supplierInvoices.at(-1) ?? null;

  return {
    workspace,
    accounts,
    bankAccounts,
    bankTransactions,
    parties,
    invoices,
    latestInvoice,
    latestInvoiceParty: latestInvoice
      ? parties.find((party) => party.id === latestInvoice.partyId) ?? null
      : null,
    supplierInvoices,
    latestSupplierInvoice,
    latestSupplierInvoiceParty: latestSupplierInvoice
      ? parties.find((party) => party.id === latestSupplierInvoice.partyId) ?? null
      : null,
    journalEntries,
    balances: calculateAccountBalances(journalEntries)
  };
}
