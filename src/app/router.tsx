import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet
} from "@tanstack/react-router";
import { App } from "./App";
import { WorkspaceView } from "./WorkspaceView";
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

const rootRoute = createRootRoute({
  component: App
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: redirectToDashboard
});

const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "workspace",
  component: WorkspaceView
});

const workspaceIndexRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "/",
  component: redirectToDashboard
});

const dashboardRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "dashboard",
  component: DashboardPage
});

const salesRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "sales",
  component: passThrough
});

const salesIndexRoute = createRoute({
  getParentRoute: () => salesRoute,
  path: "/",
  component: redirectToSalesInvoices
});

const salesInvoicesRoute = createRoute({
  getParentRoute: () => salesRoute,
  path: "invoices",
  component: SalesPage
});

const salesInvoiceCreateRoute = createRoute({
  getParentRoute: () => salesRoute,
  path: "invoices/new",
  component: SalesInvoiceCreatePage
});

const salesInvoiceDetailRoute = createRoute({
  getParentRoute: () => salesRoute,
  path: "invoices/$invoiceId",
  component: SalesInvoiceDetailPage
});

const salesInvoiceEditRoute = createRoute({
  getParentRoute: () => salesRoute,
  path: "invoices/$invoiceId/edit",
  component: SalesInvoiceEditPage
});

const purchasesRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "purchases",
  component: passThrough
});

const purchasesIndexRoute = createRoute({
  getParentRoute: () => purchasesRoute,
  path: "/",
  component: redirectToPurchasesInvoices
});

const supplierInvoicesRoute = createRoute({
  getParentRoute: () => purchasesRoute,
  path: "supplier-invoices",
  component: PurchasesPage
});

const supplierInvoiceCreateRoute = createRoute({
  getParentRoute: () => purchasesRoute,
  path: "supplier-invoices/new",
  component: SupplierInvoiceCreatePage
});

const supplierInvoiceDetailRoute = createRoute({
  getParentRoute: () => purchasesRoute,
  path: "supplier-invoices/$supplierInvoiceId",
  component: SupplierInvoiceDetailPage
});

const supplierInvoiceEditRoute = createRoute({
  getParentRoute: () => purchasesRoute,
  path: "supplier-invoices/$supplierInvoiceId/edit",
  component: SupplierInvoiceEditPage
});

const ownerTransactionsRoute = createRoute({
  getParentRoute: () => purchasesRoute,
  path: "owner-transactions",
  component: PurchasesPage
});

const ownerTransactionCreateRoute = createRoute({
  getParentRoute: () => purchasesRoute,
  path: "owner-transactions/new",
  component: OwnerTransactionCreatePage
});

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
  component: BankingAccountsPage
});

const bankingAccountCreateRoute = createRoute({
  getParentRoute: () => bankingRoute,
  path: "accounts/new",
  component: BankingAccountCreatePage
});

const bankingAccountDetailRoute = createRoute({
  getParentRoute: () => bankingRoute,
  path: "accounts/$bankAccountId",
  component: BankingAccountDetailPage
});

const bankingAccountEditRoute = createRoute({
  getParentRoute: () => bankingRoute,
  path: "accounts/$bankAccountId/edit",
  component: BankingAccountEditPage
});

const bankingAccountCardRoute = createRoute({
  getParentRoute: () => bankingRoute,
  path: "accounts/$bankAccountId/card",
  component: BankingAccountCardPage
});

const bankingTransactionsRoute = createRoute({
  getParentRoute: () => bankingRoute,
  path: "transactions",
  component: BankingTransactionsPage
});

const bankingTransactionCreateRoute = createRoute({
  getParentRoute: () => bankingRoute,
  path: "transactions/new",
  component: BankingTransactionCreatePage
});

const bankingTransactionDetailRoute = createRoute({
  getParentRoute: () => bankingRoute,
  path: "transactions/$bankTransactionId",
  component: BankingTransactionDetailPage
});

const bankingTransactionEditRoute = createRoute({
  getParentRoute: () => bankingRoute,
  path: "transactions/$bankTransactionId/edit",
  component: BankingTransactionEditPage
});

const counterpartiesRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "counterparties",
  component: CounterpartiesPage
});

const counterpartyCreateRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "counterparties/new",
  component: CounterpartyCreatePage
});

const counterpartyDetailRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "counterparties/$partyId",
  component: CounterpartyDetailPage
});

const counterpartyEditRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "counterparties/$partyId/edit",
  component: CounterpartyEditPage
});

const counterpartyCardRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "counterparties/$partyId/card",
  component: CounterpartyCardPage
});

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
  component: AccountingJournalPage
});

const journalEntryDetailRoute = createRoute({
  getParentRoute: () => accountingRoute,
  path: "journal-entries/$journalEntryId",
  component: JournalEntryDetailPage
});

const journalEntryEditRoute = createRoute({
  getParentRoute: () => accountingRoute,
  path: "journal-entries/$journalEntryId/edit",
  component: JournalEntryEditPage
});

const chartRoute = createRoute({
  getParentRoute: () => accountingRoute,
  path: "chart",
  component: AccountingChartPage
});

const accountCreateRoute = createRoute({
  getParentRoute: () => accountingRoute,
  path: "chart/new",
  component: AccountCreatePage
});

const accountDetailRoute = createRoute({
  getParentRoute: () => accountingRoute,
  path: "chart/$accountId",
  component: AccountDetailPage
});

const accountEditRoute = createRoute({
  getParentRoute: () => accountingRoute,
  path: "chart/$accountId/edit",
  component: AccountEditPage
});

const settingsRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "settings",
  component: SettingsPage
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  workspaceRoute.addChildren([
    workspaceIndexRoute,
    dashboardRoute,
    salesRoute.addChildren([
      salesIndexRoute,
      salesInvoicesRoute,
      salesInvoiceCreateRoute,
      salesInvoiceDetailRoute,
      salesInvoiceEditRoute
    ]),
    purchasesRoute.addChildren([
      purchasesIndexRoute,
      supplierInvoicesRoute,
      supplierInvoiceCreateRoute,
      supplierInvoiceDetailRoute,
      supplierInvoiceEditRoute,
      ownerTransactionsRoute,
      ownerTransactionCreateRoute
    ]),
    bankingRoute.addChildren([
      bankingIndexRoute,
      bankingAccountsRoute,
      bankingAccountCreateRoute,
      bankingAccountDetailRoute,
      bankingAccountEditRoute,
      bankingAccountCardRoute,
      bankingTransactionsRoute,
      bankingTransactionCreateRoute,
      bankingTransactionDetailRoute,
      bankingTransactionEditRoute
    ]),
    counterpartiesRoute,
    counterpartyCreateRoute,
    counterpartyDetailRoute,
    counterpartyEditRoute,
    counterpartyCardRoute,
    accountingRoute.addChildren([
      accountingIndexRoute,
      journalEntriesRoute,
      journalEntryDetailRoute,
      journalEntryEditRoute,
      chartRoute,
      accountCreateRoute,
      accountDetailRoute,
      accountEditRoute
    ]),
    settingsRoute
  ])
]);

export const router = createRouter({
  routeTree
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
