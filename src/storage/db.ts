import Dexie, { type Table } from "dexie";
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

export class SpbookDatabase extends Dexie {
  workspaces!: Table<Workspace, string>;
  accounts!: Table<Account, string>;
  bankAccounts!: Table<BankAccount, string>;
  bankTransactions!: Table<BankTransaction, string>;
  parties!: Table<Party, string>;
  invoices!: Table<Invoice, string>;
  supplierInvoices!: Table<SupplierInvoice, string>;
  journalEntries!: Table<JournalEntry, string>;

  constructor(name = "spbook") {
    super(name);

    this.version(1).stores({
      workspaces: "id, countryCode, baseCurrency, updatedAt",
      accounts: "id, workspaceId, code, parentCode, role, active"
    });

    this.version(2).stores({
      workspaces: "id, countryCode, baseCurrency, updatedAt",
      accounts: "id, workspaceId, code, parentCode, role, active",
      parties: "id, workspaceId, active",
      invoices: "id, workspaceId, number, partyId, status",
      journalEntries: "id, workspaceId, entryDate, sourceType, sourceId"
    });

    this.version(3).stores({
      workspaces: "id, countryCode, baseCurrency, updatedAt",
      accounts: "id, workspaceId, code, parentCode, role, active",
      parties: "id, workspaceId, active",
      invoices: "id, workspaceId, number, partyId, status",
      supplierInvoices: "id, workspaceId, number, partyId, status",
      journalEntries: "id, workspaceId, entryDate, sourceType, sourceId"
    });

    this.version(4).stores({
      workspaces: "id, countryCode, baseCurrency, updatedAt",
      accounts: "id, workspaceId, code, parentCode, role, active",
      bankAccounts: "id, workspaceId, accountCode, active",
      bankTransactions:
        "id, workspaceId, bankAccountId, bookingDate, status, matchedDocumentType, matchedDocumentId",
      parties: "id, workspaceId, active",
      invoices: "id, workspaceId, number, partyId, status",
      supplierInvoices: "id, workspaceId, number, partyId, status",
      journalEntries: "id, workspaceId, entryDate, sourceType, sourceId"
    });

    this.version(5).stores({
      workspaces: "id, countryCode, baseCurrency, updatedAt",
      accounts: "id, workspaceId, code, parentCode, role, active",
      bankAccounts: "id, workspaceId, accountCode, active",
      bankTransactions:
        "id, workspaceId, bankAccountId, bookingDate, status, matchedDocumentType, matchedDocumentId, externalId",
      parties: "id, workspaceId, active",
      invoices: "id, workspaceId, number, partyId, status",
      supplierInvoices: "id, workspaceId, number, partyId, status",
      journalEntries: "id, workspaceId, entryDate, sourceType, sourceId"
    });
  }
}

export function createDatabase(name?: string) {
  return new SpbookDatabase(name);
}

export const db = createDatabase();
