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
import { clearDatabase } from "../storage/repositories";
import { loadWorkspaceOverview, type WorkspaceOverview } from "./workspace-overview";

export type WorkspaceBackup = {
  format: "spbook-local-backup";
  formatVersion: 1;
  exportedAt: string;
  data: {
    workspaces: Workspace[];
    accounts: Account[];
    bankAccounts: BankAccount[];
    bankTransactions: BankTransaction[];
    parties: Party[];
    invoices: Invoice[];
    supplierInvoices: SupplierInvoice[];
    journalEntries: JournalEntry[];
  };
};

export async function exportWorkspaceBackup(
  database: SpbookDatabase = db
): Promise<WorkspaceBackup> {
  return {
    format: "spbook-local-backup",
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    data: {
      workspaces: await database.workspaces.toArray(),
      accounts: await database.accounts.toArray(),
      bankAccounts: await database.bankAccounts.toArray(),
      bankTransactions: await database.bankTransactions.toArray(),
      parties: await database.parties.toArray(),
      invoices: await database.invoices.toArray(),
      supplierInvoices: await database.supplierInvoices.toArray(),
      journalEntries: await database.journalEntries.toArray()
    }
  };
}

export async function importWorkspaceBackup(
  backup: WorkspaceBackup,
  database: SpbookDatabase = db
): Promise<WorkspaceOverview> {
  validateBackup(backup);

  await clearDatabase(database);
  await database.transaction(
    "rw",
    [
      database.workspaces,
      database.accounts,
      database.bankAccounts,
      database.bankTransactions,
      database.parties,
      database.invoices,
      database.supplierInvoices,
      database.journalEntries
    ],
    async () => {
      await database.workspaces.bulkPut(backup.data.workspaces);
      await database.accounts.bulkPut(backup.data.accounts);
      await database.parties.bulkPut(backup.data.parties);
      await database.invoices.bulkPut(backup.data.invoices);
      await database.supplierInvoices.bulkPut(backup.data.supplierInvoices);
      await database.bankAccounts.bulkPut(backup.data.bankAccounts);
      await database.bankTransactions.bulkPut(backup.data.bankTransactions);
      await database.journalEntries.bulkPut(backup.data.journalEntries);
    }
  );

  return loadWorkspaceOverview(backup.data.workspaces[0]!.id, database);
}

export function parseWorkspaceBackup(json: string): WorkspaceBackup {
  const parsed = JSON.parse(json) as unknown;
  validateBackup(parsed);
  return parsed;
}

function validateBackup(value: unknown): asserts value is WorkspaceBackup {
  if (!value || typeof value !== "object") {
    throw new Error("Backup file is invalid.");
  }

  const backup = value as Partial<WorkspaceBackup>;

  if (
    backup.format !== "spbook-local-backup" ||
    backup.formatVersion !== 1 ||
    !backup.data
  ) {
    throw new Error("Backup file format is not supported.");
  }

  if (!Array.isArray(backup.data.workspaces) || backup.data.workspaces.length === 0) {
    throw new Error("Backup file does not contain a workspace.");
  }
}
