import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet
} from "@tanstack/react-router";
import { App } from "./App";
import { WorkspaceView } from "./WorkspaceView";
import { DashboardPage } from "../pages/workspace/DashboardPage";
import { SalesPage } from "../pages/workspace/SalesPage";
import { PurchasesPage } from "../pages/workspace/PurchasesPage";
import { BankingAccountsPage } from "../pages/workspace/BankingAccountsPage";
import { BankingTransactionsPage } from "../pages/workspace/BankingTransactionsPage";
import { CounterpartiesPage } from "../pages/workspace/CounterpartiesPage";
import { AccountingJournalPage } from "../pages/workspace/AccountingJournalPage";
import { AccountingChartPage } from "../pages/workspace/AccountingChartPage";
import { SettingsPage } from "../pages/workspace/SettingsPage";

const passThrough = () => <Outlet />;

const rootRoute = createRootRoute({
  component: App
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: passThrough
});

const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "workspace",
  component: WorkspaceView
});

const workspaceIndexRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "/",
  component: passThrough
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

const salesInvoicesRoute = createRoute({
  getParentRoute: () => salesRoute,
  path: "invoices",
  component: SalesPage
});

const salesInvoiceCreateRoute = createRoute({
  getParentRoute: () => salesInvoicesRoute,
  path: "new"
});

const salesInvoiceDetailRoute = createRoute({
  getParentRoute: () => salesInvoicesRoute,
  path: "$invoiceId"
});

const salesInvoiceEditRoute = createRoute({
  getParentRoute: () => salesInvoiceDetailRoute,
  path: "edit"
});

const purchasesRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "purchases",
  component: passThrough
});

const supplierInvoicesRoute = createRoute({
  getParentRoute: () => purchasesRoute,
  path: "supplier-invoices",
  component: PurchasesPage
});

const supplierInvoiceCreateRoute = createRoute({
  getParentRoute: () => supplierInvoicesRoute,
  path: "new"
});

const supplierInvoiceDetailRoute = createRoute({
  getParentRoute: () => supplierInvoicesRoute,
  path: "$supplierInvoiceId"
});

const supplierInvoiceEditRoute = createRoute({
  getParentRoute: () => supplierInvoiceDetailRoute,
  path: "edit"
});

const ownerTransactionsRoute = createRoute({
  getParentRoute: () => purchasesRoute,
  path: "owner-transactions",
  component: PurchasesPage
});

const ownerTransactionCreateRoute = createRoute({
  getParentRoute: () => ownerTransactionsRoute,
  path: "new"
});

const bankingRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "banking",
  component: passThrough
});

const bankingAccountsRoute = createRoute({
  getParentRoute: () => bankingRoute,
  path: "accounts",
  component: BankingAccountsPage
});

const bankingAccountCreateRoute = createRoute({
  getParentRoute: () => bankingAccountsRoute,
  path: "new"
});

const bankingAccountDetailRoute = createRoute({
  getParentRoute: () => bankingAccountsRoute,
  path: "$bankAccountId"
});

const bankingAccountEditRoute = createRoute({
  getParentRoute: () => bankingAccountDetailRoute,
  path: "edit"
});

const bankingAccountCardRoute = createRoute({
  getParentRoute: () => bankingAccountDetailRoute,
  path: "card"
});

const bankingTransactionsRoute = createRoute({
  getParentRoute: () => bankingRoute,
  path: "transactions",
  component: BankingTransactionsPage
});

const bankingTransactionCreateRoute = createRoute({
  getParentRoute: () => bankingTransactionsRoute,
  path: "new"
});

const bankingTransactionDetailRoute = createRoute({
  getParentRoute: () => bankingTransactionsRoute,
  path: "$bankTransactionId"
});

const bankingTransactionEditRoute = createRoute({
  getParentRoute: () => bankingTransactionDetailRoute,
  path: "edit"
});

const counterpartiesRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "counterparties",
  component: CounterpartiesPage
});

const counterpartyCreateRoute = createRoute({
  getParentRoute: () => counterpartiesRoute,
  path: "new"
});

const counterpartyDetailRoute = createRoute({
  getParentRoute: () => counterpartiesRoute,
  path: "$partyId"
});

const counterpartyEditRoute = createRoute({
  getParentRoute: () => counterpartyDetailRoute,
  path: "edit"
});

const counterpartyCardRoute = createRoute({
  getParentRoute: () => counterpartyDetailRoute,
  path: "card"
});

const accountingRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "accounting",
  component: passThrough
});

const journalEntriesRoute = createRoute({
  getParentRoute: () => accountingRoute,
  path: "journal-entries",
  component: AccountingJournalPage
});

const journalEntryDetailRoute = createRoute({
  getParentRoute: () => journalEntriesRoute,
  path: "$journalEntryId"
});

const journalEntryEditRoute = createRoute({
  getParentRoute: () => journalEntryDetailRoute,
  path: "edit"
});

const chartRoute = createRoute({
  getParentRoute: () => accountingRoute,
  path: "chart",
  component: AccountingChartPage
});

const accountCreateRoute = createRoute({
  getParentRoute: () => chartRoute,
  path: "new"
});

const accountDetailRoute = createRoute({
  getParentRoute: () => chartRoute,
  path: "$accountId"
});

const accountEditRoute = createRoute({
  getParentRoute: () => accountDetailRoute,
  path: "edit"
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
      salesInvoicesRoute.addChildren([
        salesInvoiceCreateRoute,
        salesInvoiceDetailRoute.addChildren([salesInvoiceEditRoute])
      ])
    ]),
    purchasesRoute.addChildren([
      supplierInvoicesRoute.addChildren([
        supplierInvoiceCreateRoute,
        supplierInvoiceDetailRoute.addChildren([supplierInvoiceEditRoute])
      ]),
      ownerTransactionsRoute.addChildren([ownerTransactionCreateRoute])
    ]),
    bankingRoute.addChildren([
      bankingAccountsRoute.addChildren([
        bankingAccountCreateRoute,
        bankingAccountDetailRoute.addChildren([bankingAccountEditRoute, bankingAccountCardRoute])
      ]),
      bankingTransactionsRoute.addChildren([
        bankingTransactionCreateRoute,
        bankingTransactionDetailRoute.addChildren([bankingTransactionEditRoute])
      ])
    ]),
    counterpartiesRoute.addChildren([
      counterpartyCreateRoute,
      counterpartyDetailRoute.addChildren([counterpartyEditRoute, counterpartyCardRoute])
    ]),
    accountingRoute.addChildren([
      journalEntriesRoute.addChildren([journalEntryDetailRoute.addChildren([journalEntryEditRoute])]),
      chartRoute.addChildren([accountCreateRoute, accountDetailRoute.addChildren([accountEditRoute])])
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
