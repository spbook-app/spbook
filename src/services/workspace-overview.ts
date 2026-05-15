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
