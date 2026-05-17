import type {
  Account,
  BankAccount,
  BankTransaction,
  Invoice,
  JournalEntry,
  Party,
  SupplierInvoice,
  Workspace,
} from "../domain";

export interface WorkspaceRepository {
  /** Returns the total number of workspaces. Used in initialize-workspace and settings. */
  count(): Promise<number>;
  getFirst(): Promise<Workspace | undefined>;
}

export interface AccountRepository {
  getById(id: string): Promise<Account | undefined>;
  getByWorkspaceId(workspaceId: string): Promise<Account[]>;
  save(account: Account): Promise<void>;
}

export interface PartyRepository {
  getById(id: string): Promise<Party | undefined>;
  getByWorkspaceId(workspaceId: string): Promise<Party[]>;
  save(party: Party): Promise<void>;
}

export interface BankAccountRepository {
  getById(id: string): Promise<BankAccount | undefined>;
  getByWorkspaceId(workspaceId: string): Promise<BankAccount[]>;
  save(bankAccount: BankAccount): Promise<void>;
}

export interface BankTransactionRepository {
  getById(id: string): Promise<BankTransaction | undefined>;
  getByWorkspaceId(workspaceId: string): Promise<BankTransaction[]>;
  save(bankTransaction: BankTransaction): Promise<void>;
  /** Bulk save — used for CAMT.053 import. */
  saveAll(bankTransactions: BankTransaction[]): Promise<void>;
}

export interface InvoiceRepository {
  getById(id: string): Promise<Invoice | undefined>;
  getByWorkspaceId(workspaceId: string): Promise<Invoice[]>;
  save(invoice: Invoice): Promise<void>;
}

export interface SupplierInvoiceRepository {
  getById(id: string): Promise<SupplierInvoice | undefined>;
  getByWorkspaceId(workspaceId: string): Promise<SupplierInvoice[]>;
  save(supplierInvoice: SupplierInvoice): Promise<void>;
}

export interface JournalEntryRepository {
  getById(id: string): Promise<JournalEntry | undefined>;
  getByWorkspaceId(workspaceId: string): Promise<JournalEntry[]>;
  save(journalEntry: JournalEntry): Promise<void>;
}

/**
 * Container for all entity repositories.
 *
 * Write methods (save, saveAll) wrap simple non-transactional Dexie put/bulkPut
 * operations. Transactional workflow writes (saveInvoiceWorkflowData, etc.)
 * remain as free functions in repositories.ts and are not part of this interface.
 */
export interface Repositories {
  workspace: WorkspaceRepository;
  accounts: AccountRepository;
  parties: PartyRepository;
  bankAccounts: BankAccountRepository;
  bankTransactions: BankTransactionRepository;
  invoices: InvoiceRepository;
  supplierInvoices: SupplierInvoiceRepository;
  journalEntries: JournalEntryRepository;
}
