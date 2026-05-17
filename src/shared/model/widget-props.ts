/**
 * Widget-specific prop interfaces.
 * Each widget receives only the data it needs + callback for updates.
 * This replaces passing the monolithic ReadyWorkspaceData object.
 */

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

// ===== Sales Widget =====
export interface SalesInvoicesViewProps {
  workspace: Workspace;
  invoices: Invoice[];
  parties: Party[];
  bankTransactions: BankTransaction[];
  journalEntries: JournalEntry[];
  bankAccounts: BankAccount[];
  accounts: Account[];
}

// ===== Purchases Widget =====
export interface PurchasesViewProps {
  workspace: Workspace;
  supplierInvoices: SupplierInvoice[];
  parties: Party[];
  bankTransactions: BankTransaction[];
  journalEntries: JournalEntry[];
  accounts: Account[];
}

// ===== Counterparties Widget =====
export interface CounterpartiesViewProps {
  workspace: Workspace;
  parties: Party[];
  invoices: Invoice[];
  supplierInvoices: SupplierInvoice[];
  bankAccounts: BankAccount[];
}

// ===== Accounting Widget =====
export interface AccountingViewProps {
  workspace: Workspace;
  accounts: Account[];
  journalEntries: JournalEntry[];
  balances: AccountBalance[];
  parties: Party[];
  invoices: Invoice[];
  supplierInvoices: SupplierInvoice[];
  bankAccounts: BankAccount[];
}

// ===== Accounting Journal Widget =====
export interface JournalEntriesViewProps extends AccountingViewProps {
  accountNames: Map<string, string>;
}

// ===== Banking Accounts Widget =====
export interface BankingAccountsViewProps {
  workspace: Workspace;
  bankAccounts: BankAccount[];
  accounts: Account[];
  bankTransactions: BankTransaction[];
  invoices: Invoice[];
  parties: Party[];
  supplierInvoices: SupplierInvoice[];
}

// ===== Bank Transaction List Widget =====
export interface BankTransactionListProps {
  workspace: Workspace;
  bankTransactions: BankTransaction[];
  parties: Party[];
  accounts: Account[];
  invoices: Invoice[];
  supplierInvoices: SupplierInvoice[];
  bankAccounts: BankAccount[];
}

// ===== Dashboard Widget =====
export interface DashboardViewProps {
  workspace: Workspace;
  invoices: Invoice[];
  supplierInvoices: SupplierInvoice[];
  bankTransactions: BankTransaction[];
  journalEntries: JournalEntry[];
  accounts: Account[];
  balances: AccountBalance[];
  accountNames: Map<string, string>;
}

// ===== Settings Widget =====
export interface SettingsPanelProps {
  workspace: Workspace;
  accounts: Account[];
  initializedWorkspace: boolean;
  showReset: boolean;
}

// ===== Workspace Sidebar Widget =====
export interface WorkspaceSidebarProps {
  workspace: Workspace;
  invoices: Invoice[];
  supplierInvoices: SupplierInvoice[];
  bankTransactions: BankTransaction[];
  activeSection: string;
}
