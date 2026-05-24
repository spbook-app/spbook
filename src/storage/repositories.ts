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
import type { Repositories } from "./interfaces";

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

export function getJournalEntryById(
  journalEntryId: string,
  database: SpbookDatabase = db
) {
  return database.journalEntries.get(journalEntryId);
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

export function saveSupplierInvoice(
  supplierInvoice: SupplierInvoice,
  database: SpbookDatabase = db
) {
  return database.supplierInvoices.put(supplierInvoice);
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

export async function deleteInvoiceWorkflowData(
  data: {
    invoiceId: string;
    journalEntryIds: string[];
  },
  database: SpbookDatabase = db
) {
  await database.transaction(
    "rw",
    database.invoices,
    database.journalEntries,
    async () => {
      await database.invoices.delete(data.invoiceId);
      await database.journalEntries.bulkDelete(data.journalEntryIds);
    }
  );
}

export async function revertInvoiceToDraft(
  data: {
    invoice: Invoice;
    journalEntryId: string;
  },
  database: SpbookDatabase = db
) {
  await database.transaction(
    "rw",
    database.invoices,
    database.journalEntries,
    async () => {
      await database.invoices.put(data.invoice);
      await database.journalEntries.delete(data.journalEntryId);
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

export async function deleteSupplierInvoiceWorkflowData(
  data: {
    supplierInvoiceId: string;
    journalEntryIds: string[];
  },
  database: SpbookDatabase = db
) {
  await database.transaction(
    "rw",
    database.supplierInvoices,
    database.journalEntries,
    async () => {
      await database.supplierInvoices.delete(data.supplierInvoiceId);
      await database.journalEntries.bulkDelete(data.journalEntryIds);
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

export async function undoBankTransactionPostingData(
  data: {
    bankTransaction: BankTransaction;
    invoice?: Invoice;
    supplierInvoice?: SupplierInvoice;
    journalEntryId: string;
  },
  database: SpbookDatabase = db
) {
  await database.transaction(
    "rw",
    database.bankTransactions,
    database.invoices,
    database.supplierInvoices,
    database.journalEntries,
    async () => {
      await database.bankTransactions.put(data.bankTransaction);
      if (data.invoice) {
        await database.invoices.put(data.invoice);
      }
      if (data.supplierInvoice) {
        await database.supplierInvoices.put(data.supplierInvoice);
      }
      await database.journalEntries.delete(data.journalEntryId);
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

// ---------------------------------------------------------------------------
// Repository factory
// ---------------------------------------------------------------------------

/**
 * Creates a {@link Repositories} object wrapping all simple (non-transactional)
 * repository operations for the given database instance.
 *
 * Transactional workflow writes (saveInvoiceWorkflowData, etc.) remain as
 * standalone free functions and are not part of this interface.
 */
export function createRepositories(database: SpbookDatabase = db): Repositories {
  return {
    workspace: {
      count: () => getWorkspaceCount(database),
      getFirst: () => getFirstWorkspace(database),
    },
    accounts: {
      getById: (id) => getAccountById(id, database),
      getByWorkspaceId: (wid) => getAccountsByWorkspaceId(wid, database),
      save: (account) => saveAccount(account, database).then(() => undefined),
    },
    parties: {
      getById: (id) => getPartyById(id, database),
      getByWorkspaceId: (wid) => getPartiesByWorkspaceId(wid, database),
      save: (party) => saveParty(party, database).then(() => undefined),
    },
    bankAccounts: {
      getById: (id) => getBankAccountById(id, database),
      getByWorkspaceId: (wid) => getBankAccountsByWorkspaceId(wid, database),
      save: (ba) => saveBankAccount(ba, database).then(() => undefined),
    },
    bankTransactions: {
      getById: (id) => getBankTransactionById(id, database),
      getByWorkspaceId: (wid) => getBankTransactionsByWorkspaceId(wid, database),
      save: (tx) => saveBankTransaction(tx, database).then(() => undefined),
      saveAll: (txs) => saveBankTransactions(txs, database).then(() => undefined),
    },
    invoices: {
      getById: (id) => getInvoiceById(id, database),
      getByWorkspaceId: (wid) => getInvoicesByWorkspaceId(wid, database),
      save: (invoice) => saveInvoice(invoice, database).then(() => undefined),
    },
    supplierInvoices: {
      getById: (id) => getSupplierInvoiceById(id, database),
      getByWorkspaceId: (wid) => getSupplierInvoicesByWorkspaceId(wid, database),
      save: (si) => saveSupplierInvoice(si, database).then(() => undefined),
    },
    journalEntries: {
      getById: (id) => getJournalEntryById(id, database),
      getByWorkspaceId: (wid) => getJournalEntriesByWorkspaceId(wid, database),
      save: (je) => saveJournalEntry(je, database).then(() => undefined),
    },
  };
}

/** Default repository instance backed by the production IndexedDB singleton. */
export const defaultRepositories: Repositories = createRepositories(db);
