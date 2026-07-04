import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Navigate,
  Outlet
} from "@tanstack/react-router";
import { App } from "./App";
import { defaultCountryConfig } from "./country-config";
import { WorkspaceView } from "./WorkspaceView";
import { WorkspaceLoadingView, WorkspaceErrorView } from "./WorkspaceStates";
import { DashboardPage } from "../pages/workspace/DashboardPage";
import {
  SalesInvoiceCreatePage,
  SalesInvoiceDetailPage,
  SalesInvoiceEditPage,
  SalesPage
} from "../pages/workspace/SalesPage";
import {
  OwnerTransactionCreatePage,
  PurchasesPage,
  SupplierInvoiceCreatePage,
  SupplierInvoiceDetailPage,
  SupplierInvoiceEditPage
} from "../pages/workspace/PurchasesPage";
import {
  BankingAccountCardPage,
  BankingAccountCreatePage,
  BankingAccountDetailPage,
  BankingAccountEditPage,
  BankingAccountsPage
} from "../pages/workspace/BankingAccountsPage";
import {
  BankingTransactionCreatePage,
  BankingTransactionDetailPage,
  BankingTransactionEditPage,
  BankingTransactionsPage
} from "../pages/workspace/BankingTransactionsPage";
import {
  CounterpartiesPage,
  CounterpartyCardPage,
  CounterpartyCreatePage,
  CounterpartyDetailPage,
  CounterpartyEditPage
} from "../pages/workspace/CounterpartiesPage";
import {
  AccountingJournalPage,
  JournalEntryDetailPage,
  JournalEntryEditPage
} from "../pages/workspace/AccountingJournalPage";
import {
  AccountCreatePage,
  AccountDetailPage,
  AccountEditPage,
  AccountingChartPage
} from "../pages/workspace/AccountingChartPage";
import { SettingsPage } from "../pages/workspace/SettingsPage";
import { initializeDefaultWorkspace } from "../storage/initialize-workspace";
import { loadWorkspaceOverview } from "../services/workspace-overview";
import {
  getInvoiceById,
  getSupplierInvoiceById,
  getBankAccountById,
  getBankTransactionById,
  getPartyById,
  getJournalEntryById,
  getAccountById
} from "../storage/repositories";
import type { WorkspaceSection } from "../pages/workspace/model";
import {
  invoiceStatuses,
  supplierInvoiceFilters,
  type InvoiceStatus,
  type SupplierInvoiceFilter
} from "../domain/types";
import {
  bankTransactionQuickFilters,
  type BankTransactionQuickFilterValue
} from "../widgets/banking/bank-transaction-display";
import { parseEnumParam } from "../shared/lib/parse-enum-param";

// ---------------------------------------------------------------------------
// Router context
// ---------------------------------------------------------------------------

interface RouterContext {
  workspaceId: string;
  initializedWorkspace: boolean;
}

// ---------------------------------------------------------------------------
// Static data augmentation for breadcrumbs and section tracking
// ---------------------------------------------------------------------------

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    breadcrumb?: string;
    section?: WorkspaceSection;
  }
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

const passThrough = () => <Outlet />;
const redirectToDashboard = () => <Navigate to="/workspace/dashboard" replace />;
const redirectToSalesInvoices = () => <Navigate to="/workspace/sales/invoices" replace />;
const redirectToPurchasesInvoices = () => (
  <Navigate to="/workspace/purchases/supplier-invoices" replace />
);
const redirectToBankingAccounts = () => <Navigate to="/workspace/banking/accounts" replace />;
const redirectToAccountingJournal = () => (
  <Navigate to="/workspace/accounting/journal-entries" replace />
);

// ---------------------------------------------------------------------------
// Typed URL search params for filtered list routes
// ---------------------------------------------------------------------------

export interface SalesInvoicesSearch {
  status?: InvoiceStatus;
}

export interface SupplierInvoicesSearch {
  status?: SupplierInvoiceFilter;
}

export interface BankTransactionsSearch {
  bankAccountId?: string;
  processingState?: BankTransactionQuickFilterValue;
}

function validateSalesInvoicesSearch(search: Record<string, unknown>): SalesInvoicesSearch {
  const status = parseEnumParam(search.status, invoiceStatuses);
  return status ? { status } : {};
}

function validateSupplierInvoicesSearch(
  search: Record<string, unknown>
): SupplierInvoicesSearch {
  const status = parseEnumParam(search.status, supplierInvoiceFilters);
  return status ? { status } : {};
}

function validateBankTransactionsSearch(
  search: Record<string, unknown>
): BankTransactionsSearch {
  const result: BankTransactionsSearch = {};
  if (typeof search.bankAccountId === "string" && search.bankAccountId) {
    result.bankAccountId = search.bankAccountId;
  }
  const processingState = parseEnumParam(search.processingState, bankTransactionQuickFilters);
  if (processingState) {
    result.processingState = processingState;
  }
  return result;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: App
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: redirectToDashboard
});

// ---------------------------------------------------------------------------
// Workspace route — initializes workspace, loads all data
// ---------------------------------------------------------------------------

export const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "workspace",
  component: WorkspaceView,
  pendingComponent: WorkspaceLoadingView,
  errorComponent: WorkspaceErrorView,
  beforeLoad: async () => {
    const init = await initializeDefaultWorkspace(defaultCountryConfig);
    return { workspaceId: init.workspace.id, initializedWorkspace: init.created };
  },
  loader: async ({ context }) => {
    const overview = await loadWorkspaceOverview(context.workspaceId);
    return { ...overview, initializedWorkspace: context.initializedWorkspace };
  }
});

const workspaceIndexRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "/",
  component: redirectToDashboard
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

const dashboardRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "dashboard",
  component: DashboardPage,
  staticData: { section: "dashboard", breadcrumb: "Dashboard" }
});
// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

const salesRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "sales",
  component: passThrough,
  staticData: { section: "sales", breadcrumb: "Sales" }
});

const salesIndexRoute = createRoute({
  getParentRoute: () => salesRoute,
  path: "/",
  component: redirectToSalesInvoices
});

const salesInvoicesRoute = createRoute({
  getParentRoute: () => salesRoute,
  path: "invoices",
  component: passThrough,
  validateSearch: validateSalesInvoicesSearch,
  staticData: { breadcrumb: "Invoices" }
});

const salesInvoicesIndexRoute = createRoute({
  getParentRoute: () => salesInvoicesRoute,
  path: "/",
  component: SalesPage
});

const salesInvoiceCreateRoute = createRoute({
  getParentRoute: () => salesInvoicesRoute,
  path: "new",
  component: SalesInvoiceCreatePage,
  staticData: { breadcrumb: "New" }
});

const salesInvoiceDetailRoute = createRoute({
  getParentRoute: () => salesInvoicesRoute,
  path: "$invoiceId",
  component: passThrough,
  loader: async ({ params }) => {
    const invoice = await getInvoiceById(params.invoiceId);
    return { breadcrumb: invoice ? `Invoice ${invoice.number}` : "Invoice" };
  }
});

const salesInvoiceDetailIndexRoute = createRoute({
  getParentRoute: () => salesInvoiceDetailRoute,
  path: "/",
  component: SalesInvoiceDetailPage
});

const salesInvoiceEditRoute = createRoute({
  getParentRoute: () => salesInvoiceDetailRoute,
  path: "edit",
  component: SalesInvoiceEditPage,
  staticData: { breadcrumb: "Edit" }
});

// ---------------------------------------------------------------------------
// Purchases
// ---------------------------------------------------------------------------

const purchasesRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "purchases",
  component: passThrough,
  staticData: { section: "purchases", breadcrumb: "Purchases" }
});

const purchasesIndexRoute = createRoute({
  getParentRoute: () => purchasesRoute,
  path: "/",
  component: redirectToPurchasesInvoices
});

const supplierInvoicesRoute = createRoute({
  getParentRoute: () => purchasesRoute,
  path: "supplier-invoices",
  component: passThrough,
  validateSearch: validateSupplierInvoicesSearch,
  staticData: { breadcrumb: "Supplier invoices" }
});

const supplierInvoicesIndexRoute = createRoute({
  getParentRoute: () => supplierInvoicesRoute,
  path: "/",
  component: PurchasesPage
});

const supplierInvoiceCreateRoute = createRoute({
  getParentRoute: () => supplierInvoicesRoute,
  path: "new",
  component: SupplierInvoiceCreatePage,
  staticData: { breadcrumb: "New" }
});

const supplierInvoiceDetailRoute = createRoute({
  getParentRoute: () => supplierInvoicesRoute,
  path: "$supplierInvoiceId",
  component: passThrough,
  loader: async ({ params }) => {
    const inv = await getSupplierInvoiceById(params.supplierInvoiceId);
    return { breadcrumb: inv ? `Supplier invoice ${inv.number}` : "Supplier invoice" };
  }
});

const supplierInvoiceDetailIndexRoute = createRoute({
  getParentRoute: () => supplierInvoiceDetailRoute,
  path: "/",
  component: SupplierInvoiceDetailPage
});

const supplierInvoiceEditRoute = createRoute({
  getParentRoute: () => supplierInvoiceDetailRoute,
  path: "edit",
  component: SupplierInvoiceEditPage,
  staticData: { breadcrumb: "Edit" }
});

const ownerTransactionsRoute = createRoute({
  getParentRoute: () => purchasesRoute,
  path: "owner-transactions",
  component: passThrough,
  staticData: { breadcrumb: "Owner transactions" }
});

const ownerTransactionsIndexRoute = createRoute({
  getParentRoute: () => ownerTransactionsRoute,
  path: "/",
  component: PurchasesPage
});

const ownerTransactionCreateRoute = createRoute({
  getParentRoute: () => ownerTransactionsRoute,
  path: "new",
  component: OwnerTransactionCreatePage,
  staticData: { breadcrumb: "New" }
});

// ---------------------------------------------------------------------------
// Banking — accounts
// ---------------------------------------------------------------------------

const bankingRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "banking",
  component: passThrough
});

const bankingIndexRoute = createRoute({
  getParentRoute: () => bankingRoute,
  path: "/",
  component: redirectToBankingAccounts
});

const bankingAccountsRoute = createRoute({
  getParentRoute: () => bankingRoute,
  path: "accounts",
  component: passThrough,
  staticData: { section: "bank-accounts", breadcrumb: "Bank accounts" }
});

const bankingAccountsIndexRoute = createRoute({
  getParentRoute: () => bankingAccountsRoute,
  path: "/",
  component: BankingAccountsPage
});

const bankingAccountCreateRoute = createRoute({
  getParentRoute: () => bankingAccountsRoute,
  path: "new",
  component: BankingAccountCreatePage,
  staticData: { breadcrumb: "New" }
});

const bankingAccountDetailRoute = createRoute({
  getParentRoute: () => bankingAccountsRoute,
  path: "$bankAccountId",
  component: passThrough,
  loader: async ({ params }) => {
    const account = await getBankAccountById(params.bankAccountId);
    return { breadcrumb: account?.name ?? "Bank account" };
  }
});

const bankingAccountDetailIndexRoute = createRoute({
  getParentRoute: () => bankingAccountDetailRoute,
  path: "/",
  component: BankingAccountDetailPage
});

const bankingAccountEditRoute = createRoute({
  getParentRoute: () => bankingAccountDetailRoute,
  path: "edit",
  component: BankingAccountEditPage,
  staticData: { breadcrumb: "Edit" }
});

const bankingAccountCardRoute = createRoute({
  getParentRoute: () => bankingAccountDetailRoute,
  path: "card",
  component: BankingAccountCardPage,
  staticData: { breadcrumb: "Card" }
});

// ---------------------------------------------------------------------------
// Banking — transactions
// ---------------------------------------------------------------------------

const bankingTransactionsRoute = createRoute({
  getParentRoute: () => bankingRoute,
  path: "transactions",
  component: passThrough,
  validateSearch: validateBankTransactionsSearch,
  staticData: { section: "bank-transactions", breadcrumb: "Transactions" }
});

const bankingTransactionsIndexRoute = createRoute({
  getParentRoute: () => bankingTransactionsRoute,
  path: "/",
  component: BankingTransactionsPage
});

const bankingTransactionCreateRoute = createRoute({
  getParentRoute: () => bankingTransactionsRoute,
  path: "new",
  component: BankingTransactionCreatePage,
  staticData: { breadcrumb: "New" }
});

const bankingTransactionDetailRoute = createRoute({
  getParentRoute: () => bankingTransactionsRoute,
  path: "$bankTransactionId",
  component: passThrough,
  loader: async ({ params }) => {
    const tx = await getBankTransactionById(params.bankTransactionId);
    const breadcrumb = tx
      ? `${tx.bookingDate} · ${tx.amount} ${tx.currency}`
      : "Transaction";
    return { breadcrumb };
  }
});

const bankingTransactionDetailIndexRoute = createRoute({
  getParentRoute: () => bankingTransactionDetailRoute,
  path: "/",
  component: BankingTransactionDetailPage
});

const bankingTransactionEditRoute = createRoute({
  getParentRoute: () => bankingTransactionDetailRoute,
  path: "edit",
  component: BankingTransactionEditPage,
  staticData: { breadcrumb: "Edit" }
});

// ---------------------------------------------------------------------------
// Counterparties
// ---------------------------------------------------------------------------

const counterpartiesRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "counterparties",
  component: passThrough,
  staticData: { section: "counterparties", breadcrumb: "Counterparties" }
});

const counterpartiesIndexRoute = createRoute({
  getParentRoute: () => counterpartiesRoute,
  path: "/",
  component: CounterpartiesPage
});

const counterpartyCreateRoute = createRoute({
  getParentRoute: () => counterpartiesRoute,
  path: "new",
  component: CounterpartyCreatePage,
  staticData: { breadcrumb: "New" }
});

const counterpartyDetailRoute = createRoute({
  getParentRoute: () => counterpartiesRoute,
  path: "$partyId",
  component: passThrough,
  loader: async ({ params }) => {
    const party = await getPartyById(params.partyId);
    return { breadcrumb: party?.name ?? "Counterparty" };
  }
});

const counterpartyDetailIndexRoute = createRoute({
  getParentRoute: () => counterpartyDetailRoute,
  path: "/",
  component: CounterpartyDetailPage
});

const counterpartyEditRoute = createRoute({
  getParentRoute: () => counterpartyDetailRoute,
  path: "edit",
  component: CounterpartyEditPage,
  staticData: { breadcrumb: "Edit" }
});

const counterpartyCardRoute = createRoute({
  getParentRoute: () => counterpartyDetailRoute,
  path: "card",
  component: CounterpartyCardPage,
  staticData: { breadcrumb: "Card" }
});

// ---------------------------------------------------------------------------
// Accounting — journal entries
// ---------------------------------------------------------------------------

const accountingRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "accounting",
  component: passThrough
});

const accountingIndexRoute = createRoute({
  getParentRoute: () => accountingRoute,
  path: "/",
  component: redirectToAccountingJournal
});

const journalEntriesRoute = createRoute({
  getParentRoute: () => accountingRoute,
  path: "journal-entries",
  component: passThrough,
  staticData: { section: "journal", breadcrumb: "Journal entries" }
});

const journalEntriesIndexRoute = createRoute({
  getParentRoute: () => journalEntriesRoute,
  path: "/",
  component: AccountingJournalPage
});

const journalEntryDetailRoute = createRoute({
  getParentRoute: () => journalEntriesRoute,
  path: "$journalEntryId",
  component: passThrough,
  loader: async ({ params }) => {
    const entry = await getJournalEntryById(params.journalEntryId);
    const breadcrumb = entry
      ? `${entry.entryDate} · ${entry.description}`
      : "Journal entry";
    return { breadcrumb };
  }
});

const journalEntryDetailIndexRoute = createRoute({
  getParentRoute: () => journalEntryDetailRoute,
  path: "/",
  component: JournalEntryDetailPage
});

const journalEntryEditRoute = createRoute({
  getParentRoute: () => journalEntryDetailRoute,
  path: "edit",
  component: JournalEntryEditPage,
  staticData: { breadcrumb: "Edit" }
});

// ---------------------------------------------------------------------------
// Accounting — chart of accounts
// ---------------------------------------------------------------------------

const chartRoute = createRoute({
  getParentRoute: () => accountingRoute,
  path: "chart",
  component: passThrough,
  staticData: { section: "chart", breadcrumb: "Chart" }
});

const chartIndexRoute = createRoute({
  getParentRoute: () => chartRoute,
  path: "/",
  component: AccountingChartPage
});

const accountCreateRoute = createRoute({
  getParentRoute: () => chartRoute,
  path: "new",
  component: AccountCreatePage,
  staticData: { breadcrumb: "New" }
});

const accountDetailRoute = createRoute({
  getParentRoute: () => chartRoute,
  path: "$accountId",
  component: passThrough,
  loader: async ({ params }) => {
    const account = await getAccountById(params.accountId);
    const breadcrumb = account ? `${account.code} · ${account.name}` : "Account";
    return { breadcrumb };
  }
});

const accountDetailIndexRoute = createRoute({
  getParentRoute: () => accountDetailRoute,
  path: "/",
  component: AccountDetailPage
});

const accountEditRoute = createRoute({
  getParentRoute: () => accountDetailRoute,
  path: "edit",
  component: AccountEditPage,
  staticData: { breadcrumb: "Edit" }
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const settingsRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "settings",
  component: SettingsPage,
  staticData: { section: "settings", breadcrumb: "Settings" }
});

// ---------------------------------------------------------------------------
// Route tree
// ---------------------------------------------------------------------------

const routeTree = rootRoute.addChildren([
  indexRoute,
  workspaceRoute.addChildren([
    workspaceIndexRoute,
    dashboardRoute,
    salesRoute.addChildren([
      salesIndexRoute,
      salesInvoicesRoute.addChildren([
        salesInvoicesIndexRoute,
        salesInvoiceCreateRoute,
        salesInvoiceDetailRoute.addChildren([salesInvoiceDetailIndexRoute, salesInvoiceEditRoute])
      ])
    ]),
    purchasesRoute.addChildren([
      purchasesIndexRoute,
      supplierInvoicesRoute.addChildren([
        supplierInvoicesIndexRoute,
        supplierInvoiceCreateRoute,
        supplierInvoiceDetailRoute.addChildren([supplierInvoiceDetailIndexRoute, supplierInvoiceEditRoute])
      ]),
      ownerTransactionsRoute.addChildren([
        ownerTransactionsIndexRoute,
        ownerTransactionCreateRoute
      ])
    ]),
    bankingRoute.addChildren([
      bankingIndexRoute,
      bankingAccountsRoute.addChildren([
        bankingAccountsIndexRoute,
        bankingAccountCreateRoute,
        bankingAccountDetailRoute.addChildren([
          bankingAccountDetailIndexRoute,
          bankingAccountEditRoute,
          bankingAccountCardRoute
        ])
      ]),
      bankingTransactionsRoute.addChildren([
        bankingTransactionsIndexRoute,
        bankingTransactionCreateRoute,
        bankingTransactionDetailRoute.addChildren([bankingTransactionDetailIndexRoute, bankingTransactionEditRoute])
      ])
    ]),
    counterpartiesRoute.addChildren([
      counterpartiesIndexRoute,
      counterpartyCreateRoute,
      counterpartyDetailRoute.addChildren([counterpartyDetailIndexRoute, counterpartyEditRoute, counterpartyCardRoute])
    ]),
    accountingRoute.addChildren([
      accountingIndexRoute,
      journalEntriesRoute.addChildren([
        journalEntriesIndexRoute,
        journalEntryDetailRoute.addChildren([journalEntryDetailIndexRoute, journalEntryEditRoute])
      ]),
      chartRoute.addChildren([
        chartIndexRoute,
        accountCreateRoute,
          accountDetailRoute.addChildren([accountDetailIndexRoute, accountEditRoute])
      ])
    ]),
    settingsRoute
  ])
]);

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const router = createRouter({
  routeTree,
  context: { workspaceId: "", initializedWorkspace: false }
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
