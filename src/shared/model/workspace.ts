import type {
  Account,
  BankAccount,
  BankTransaction,
  Invoice,
  JournalEntry,
  Party,
  SupplierInvoice,
  Workspace
} from "../../domain";
import type { AccountBalance } from "../../services/balances";

/**
 * Partial workspace state produced by a single workflow mutation.
 * Contains only the entity groups that were affected.
 * Excludes `workspace` and `initializedWorkspace` — those are set at
 * initialization time and never changed by runtime mutations.
 */
export type WorkspaceDataUpdate = Partial<{
  workspace: Workspace;
  accounts: Account[];
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  parties: Party[];
  invoices: Invoice[];
  invoice: Invoice | null;
  invoiceParty: Party | null;
  supplierInvoices: SupplierInvoice[];
  supplierInvoice: SupplierInvoice | null;
  supplierInvoiceParty: Party | null;
  journalEntries: JournalEntry[];
  balances: AccountBalance[];
}>;
