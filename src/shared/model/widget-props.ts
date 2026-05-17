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
import type { AppDataState } from "./workspace";

// ===== Sales Widget =====
export interface SalesInvoicesViewProps {
  workspace: Workspace;
  invoices: Invoice[];
  parties: Party[];
  bankTransactions: BankTransaction[];
  journalEntries: JournalEntry[];
  bankAccounts: BankAccount[];
  accounts: Account[];
  onDataStateChange: (state: AppDataState) => void;
}

// ===== Purchases Widget =====
export interface PurchasesViewProps {
  workspace: Workspace;
  supplierInvoices: SupplierInvoice[];
  parties: Party[];
  bankTransactions: BankTransaction[];
  journalEntries: JournalEntry[];
  accounts: Account[];
  onDataStateChange: (state: AppDataState) => void;
}

// ===== Counterparties Widget =====
export interface CounterpartiesViewProps {
  workspace: Workspace;
  parties: Party[];
  invoices: Invoice[];
  supplierInvoices: SupplierInvoice[];
  onDataStateChange: (state: AppDataState) => void;
}

// ===== Accounting Widget =====
export interface AccountingViewProps {
  workspace: Workspace;
  accounts: Account[];
  journalEntries: JournalEntry[];
  balances: AccountBalance[];
  onDataStateChange: (state: AppDataState) => void;
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
  parties: Party[];
  onDataStateChange: (state: AppDataState) => void;
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
  onDataStateChange: (state: AppDataState) => void;
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
  onDataStateChange: (state: AppDataState) => void;
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
