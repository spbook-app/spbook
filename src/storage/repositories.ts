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

export function getAccountById(accountId: string, database: SpbookDatabase = db) {
  return database.accounts.get(accountId);
}

export function getBankAccountsByWorkspaceId(
  workspaceId: string,
  database: SpbookDatabase = db
) {
  return database.bankAccounts.where("workspaceId").equals(workspaceId).sortBy("name");
}

export function getBankAccountById(
  bankAccountId: string,
  database: SpbookDatabase = db
) {
  return database.bankAccounts.get(bankAccountId);
}

export function getBankTransactionsByWorkspaceId(
  workspaceId: string,
  database: SpbookDatabase = db
) {
  return database.bankTransactions
    .where("workspaceId")
    .equals(workspaceId)
    .sortBy("bookingDate");
}

export function getBankTransactionById(
  bankTransactionId: string,
  database: SpbookDatabase = db
) {
  return database.bankTransactions.get(bankTransactionId);
}

export function getPartiesByWorkspaceId(
  workspaceId: string,
  database: SpbookDatabase = db
) {
  return database.parties.where("workspaceId").equals(workspaceId).sortBy("name");
}

export function getPartyById(partyId: string, database: SpbookDatabase = db) {
  return database.parties.get(partyId);
}

export function getInvoicesByWorkspaceId(
  workspaceId: string,
  database: SpbookDatabase = db
) {
  return database.invoices.where("workspaceId").equals(workspaceId).sortBy("number");
}

export function getInvoiceById(invoiceId: string, database: SpbookDatabase = db) {
  return database.invoices.get(invoiceId);
}

export function getSupplierInvoicesByWorkspaceId(
  workspaceId: string,
  database: SpbookDatabase = db
) {
  return database.supplierInvoices.where("workspaceId").equals(workspaceId).sortBy("number");
}

export function getSupplierInvoiceById(
  supplierInvoiceId: string,
  database: SpbookDatabase = db
) {
  return database.supplierInvoices.get(supplierInvoiceId);
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

export function saveAccount(account: Account, database: SpbookDatabase = db) {
  return database.accounts.put(account);
}

export function saveParty(party: Party, database: SpbookDatabase = db) {
  return database.parties.put(party);
}

export function saveBankAccount(
  bankAccount: BankAccount,
  database: SpbookDatabase = db
) {
  return database.bankAccounts.put(bankAccount);
}

export function saveBankTransaction(
  bankTransaction: BankTransaction,
  database: SpbookDatabase = db
) {
  return database.bankTransactions.put(bankTransaction);
}

export function saveBankTransactions(
  bankTransactions: BankTransaction[],
  database: SpbookDatabase = db
) {
  return database.bankTransactions.bulkPut(bankTransactions);
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

export async function saveInvoiceWorkflowData(
  data: {
    party: Party;
    invoice: Invoice;
    journalEntry: JournalEntry;
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
      await database.journalEntries.put(data.journalEntry);
    }
  );
}

export async function saveInvoiceJournalEntryData(
  data: {
    invoice: Invoice;
    journalEntry: JournalEntry;
  },
  database: SpbookDatabase = db
) {
  await database.transaction(
    "rw",
    database.invoices,
    database.journalEntries,
    async () => {
      await database.invoices.put(data.invoice);
      await database.journalEntries.put(data.journalEntry);
    }
  );
}

export async function saveInvoicePaymentData(
  data: {
    invoice: Invoice;
    journalEntry: JournalEntry;
    bankTransaction?: BankTransaction;
  },
  database: SpbookDatabase = db
) {
  await database.transaction(
    "rw",
    database.invoices,
    database.bankTransactions,
    database.journalEntries,
    async () => {
      await database.invoices.put(data.invoice);
      if (data.bankTransaction) {
        await database.bankTransactions.put(data.bankTransaction);
      }
      await database.journalEntries.put(data.journalEntry);
    }
  );
}

export async function saveSupplierInvoiceWorkflowData(
  data: {
    supplier: Party;
    supplierInvoice: SupplierInvoice;
    journalEntry: JournalEntry;
  },
  database: SpbookDatabase = db
) {
  await database.transaction(
    "rw",
    database.parties,
    database.supplierInvoices,
    database.journalEntries,
    async () => {
      await database.parties.put(data.supplier);
      await database.supplierInvoices.put(data.supplierInvoice);
      await database.journalEntries.put(data.journalEntry);
    }
  );
}

export async function saveSupplierInvoiceJournalEntryData(
  data: {
    supplierInvoice: SupplierInvoice;
    journalEntry: JournalEntry;
  },
  database: SpbookDatabase = db
) {
  await database.transaction(
    "rw",
    database.supplierInvoices,
    database.journalEntries,
    async () => {
      await database.supplierInvoices.put(data.supplierInvoice);
      await database.journalEntries.put(data.journalEntry);
    }
  );
}

export async function saveSupplierInvoicePaymentData(
  data: {
    supplierInvoice: SupplierInvoice;
    journalEntry: JournalEntry;
    bankTransaction?: BankTransaction;
  },
  database: SpbookDatabase = db
) {
  await database.transaction(
    "rw",
    database.supplierInvoices,
    database.bankTransactions,
    database.journalEntries,
    async () => {
      await database.supplierInvoices.put(data.supplierInvoice);
      if (data.bankTransaction) {
        await database.bankTransactions.put(data.bankTransaction);
      }
      await database.journalEntries.put(data.journalEntry);
    }
  );
}

export async function saveBankTransactionPostingData(
  data: {
    bankTransaction: BankTransaction;
    journalEntry: JournalEntry;
  },
  database: SpbookDatabase = db
) {
  await database.transaction(
    "rw",
    database.bankTransactions,
    database.journalEntries,
    async () => {
      await database.bankTransactions.put(data.bankTransaction);
      await database.journalEntries.put(data.journalEntry);
    }
  );
}

export async function savePartyJournalEntryData(
  data: {
    party: Party;
    journalEntry: JournalEntry;
  },
  database: SpbookDatabase = db
) {
  await database.transaction(
    "rw",
    database.parties,
    database.journalEntries,
    async () => {
      await database.parties.put(data.party);
      await database.journalEntries.put(data.journalEntry);
    }
  );
}

export async function clearDatabase(database: SpbookDatabase = db) {
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
      await database.journalEntries.clear();
      await database.bankTransactions.clear();
      await database.bankAccounts.clear();
      await database.supplierInvoices.clear();
      await database.invoices.clear();
      await database.parties.clear();
      await database.accounts.clear();
      await database.workspaces.clear();
    }
  );
}
