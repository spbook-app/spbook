import type { Account, Invoice, JournalEntry, Party, Workspace } from "../domain";
import { db, type SpbookDatabase } from "./db";

export function getWorkspaceCount(database: SpbookDatabase = db) {
  return database.workspaces.count();
}

export function getFirstWorkspace(database: SpbookDatabase = db) {
  return database.workspaces.orderBy("id").first();
}

export function getAccountsByWorkspaceId(
  workspaceId: string,
  database: SpbookDatabase = db
) {
  return database.accounts.where("workspaceId").equals(workspaceId).sortBy("code");
}

export function getPartiesByWorkspaceId(
  workspaceId: string,
  database: SpbookDatabase = db
) {
  return database.parties.where("workspaceId").equals(workspaceId).sortBy("name");
}

export function getInvoicesByWorkspaceId(
  workspaceId: string,
  database: SpbookDatabase = db
) {
  return database.invoices.where("workspaceId").equals(workspaceId).sortBy("number");
}

export function getJournalEntriesByWorkspaceId(
  workspaceId: string,
  database: SpbookDatabase = db
) {
  return database.journalEntries
    .where("workspaceId")
    .equals(workspaceId)
    .sortBy("entryDate");
}

export async function saveWorkspaceWithAccounts(
  workspace: Workspace,
  accounts: Account[],
  database: SpbookDatabase = db
) {
  await database.transaction("rw", database.workspaces, database.accounts, async () => {
    await database.workspaces.put(workspace);
    await database.accounts.bulkPut(accounts);
  });
}

export function saveParty(party: Party, database: SpbookDatabase = db) {
  return database.parties.put(party);
}

export function saveInvoice(invoice: Invoice, database: SpbookDatabase = db) {
  return database.invoices.put(invoice);
}

export function saveJournalEntry(
  journalEntry: JournalEntry,
  database: SpbookDatabase = db
) {
  return database.journalEntries.put(journalEntry);
}

export async function saveDemoInvoiceFlowData(
  data: {
    party: Party;
    invoice: Invoice;
    journalEntries: JournalEntry[];
  },
  database: SpbookDatabase = db
) {
  await database.transaction(
    "rw",
    database.parties,
    database.invoices,
    database.journalEntries,
    async () => {
      await database.parties.put(data.party);
      await database.invoices.put(data.invoice);
      await database.journalEntries.bulkPut(data.journalEntries);
    }
  );
}

export async function clearDatabase(database: SpbookDatabase = db) {
  await database.transaction(
    "rw",
    [
      database.workspaces,
      database.accounts,
      database.parties,
      database.invoices,
      database.journalEntries
    ],
    async () => {
      await database.journalEntries.clear();
      await database.invoices.clear();
      await database.parties.clear();
      await database.accounts.clear();
      await database.workspaces.clear();
    }
  );
}
