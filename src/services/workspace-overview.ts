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
import type { Repositories } from "../storage/interfaces";
import { defaultRepositories } from "../storage/repositories";
import { calculateAccountBalances, type AccountBalance } from "./balances";

// ---------------------------------------------------------------------------
// Granular slice loaders — load only the entity groups that changed.
// Use these in workflow services instead of loadWorkspaceOverview.
// ---------------------------------------------------------------------------

export async function loadAccountsSlice(
  workspaceId: string,
  repos: Repositories = defaultRepositories
) {
  const accounts = await repos.accounts.getByWorkspaceId(workspaceId);
  return { accounts };
}

export async function loadPartiesSlice(
  workspaceId: string,
  repos: Repositories = defaultRepositories
) {
  const parties = await repos.parties.getByWorkspaceId(workspaceId);
  return { parties };
}

export async function loadBankingSlice(
  workspaceId: string,
  repos: Repositories = defaultRepositories
) {
  const [bankAccounts, bankTransactions] = await Promise.all([
    repos.bankAccounts.getByWorkspaceId(workspaceId),
    repos.bankTransactions.getByWorkspaceId(workspaceId),
  ]);
  return { bankAccounts, bankTransactions };
}

export async function loadLedgerSlice(
  workspaceId: string,
  repos: Repositories = defaultRepositories
) {
  const journalEntries = await repos.journalEntries.getByWorkspaceId(workspaceId);
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
  repos: Repositories = defaultRepositories
) {
  const [invoices, parties] = await Promise.all([
    repos.invoices.getByWorkspaceId(workspaceId),
    repos.parties.getByWorkspaceId(workspaceId),
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
  repos: Repositories = defaultRepositories
) {
  const [supplierInvoices, parties] = await Promise.all([
    repos.supplierInvoices.getByWorkspaceId(workspaceId),
    repos.parties.getByWorkspaceId(workspaceId),
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
  repos: Repositories = defaultRepositories
): Promise<WorkspaceOverview> {
  const workspace = await repos.workspace.getFirst();

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
      repos.accounts.getByWorkspaceId(workspaceId),
      repos.bankAccounts.getByWorkspaceId(workspaceId),
      repos.bankTransactions.getByWorkspaceId(workspaceId),
      repos.parties.getByWorkspaceId(workspaceId),
      repos.invoices.getByWorkspaceId(workspaceId),
      repos.supplierInvoices.getByWorkspaceId(workspaceId),
      repos.journalEntries.getByWorkspaceId(workspaceId),
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
