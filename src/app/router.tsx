import {
  createRootRoute,
  createRoute,
  createRouter
} from "@tanstack/react-router";
import { App } from "./App";

const emptyRouteComponent = () => null;

const rootRoute = createRootRoute({
  component: App
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: emptyRouteComponent
});

const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "workspace",
  component: emptyRouteComponent
});

const workspaceIndexRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "/",
  component: emptyRouteComponent
});

const dashboardRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "dashboard",
  component: emptyRouteComponent
});

const salesRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "sales",
  component: emptyRouteComponent
});

const salesInvoicesRoute = createRoute({
  getParentRoute: () => salesRoute,
  path: "invoices",
  component: emptyRouteComponent
});

const salesInvoiceCreateRoute = createRoute({
  getParentRoute: () => salesInvoicesRoute,
  path: "new",
  component: emptyRouteComponent
});

const salesInvoiceDetailRoute = createRoute({
  getParentRoute: () => salesInvoicesRoute,
  path: "$invoiceId",
  component: emptyRouteComponent
});

const salesInvoiceEditRoute = createRoute({
  getParentRoute: () => salesInvoiceDetailRoute,
  path: "edit",
  component: emptyRouteComponent
});

const purchasesRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "purchases",
  component: emptyRouteComponent
});

const supplierInvoicesRoute = createRoute({
  getParentRoute: () => purchasesRoute,
  path: "supplier-invoices",
  component: emptyRouteComponent
});

const supplierInvoiceCreateRoute = createRoute({
  getParentRoute: () => supplierInvoicesRoute,
  path: "new",
  component: emptyRouteComponent
});

const supplierInvoiceDetailRoute = createRoute({
  getParentRoute: () => supplierInvoicesRoute,
  path: "$supplierInvoiceId",
  component: emptyRouteComponent
});

const supplierInvoiceEditRoute = createRoute({
  getParentRoute: () => supplierInvoiceDetailRoute,
  path: "edit",
  component: emptyRouteComponent
});

const ownerTransactionsRoute = createRoute({
  getParentRoute: () => purchasesRoute,
  path: "owner-transactions",
  component: emptyRouteComponent
});

const ownerTransactionCreateRoute = createRoute({
  getParentRoute: () => ownerTransactionsRoute,
  path: "new",
  component: emptyRouteComponent
});

const bankingRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "banking",
  component: emptyRouteComponent
});

const bankingAccountsRoute = createRoute({
  getParentRoute: () => bankingRoute,
  path: "accounts",
  component: emptyRouteComponent
});

const bankingAccountCreateRoute = createRoute({
  getParentRoute: () => bankingAccountsRoute,
  path: "new",
  component: emptyRouteComponent
});

const bankingAccountDetailRoute = createRoute({
  getParentRoute: () => bankingAccountsRoute,
  path: "$bankAccountId",
  component: emptyRouteComponent
});

const bankingAccountEditRoute = createRoute({
  getParentRoute: () => bankingAccountDetailRoute,
  path: "edit",
  component: emptyRouteComponent
});

const bankingAccountCardRoute = createRoute({
  getParentRoute: () => bankingAccountDetailRoute,
  path: "card",
  component: emptyRouteComponent
});

const bankingTransactionsRoute = createRoute({
  getParentRoute: () => bankingRoute,
  path: "transactions",
  component: emptyRouteComponent
});

const bankingTransactionCreateRoute = createRoute({
  getParentRoute: () => bankingTransactionsRoute,
  path: "new",
  component: emptyRouteComponent
});

const bankingTransactionDetailRoute = createRoute({
  getParentRoute: () => bankingTransactionsRoute,
  path: "$bankTransactionId",
  component: emptyRouteComponent
});

const bankingTransactionEditRoute = createRoute({
  getParentRoute: () => bankingTransactionDetailRoute,
  path: "edit",
  component: emptyRouteComponent
});

const counterpartiesRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "counterparties",
  component: emptyRouteComponent
});

const counterpartyCreateRoute = createRoute({
  getParentRoute: () => counterpartiesRoute,
  path: "new",
  component: emptyRouteComponent
});

const counterpartyDetailRoute = createRoute({
  getParentRoute: () => counterpartiesRoute,
  path: "$partyId",
  component: emptyRouteComponent
});

const counterpartyEditRoute = createRoute({
  getParentRoute: () => counterpartyDetailRoute,
  path: "edit",
  component: emptyRouteComponent
});

const counterpartyCardRoute = createRoute({
  getParentRoute: () => counterpartyDetailRoute,
  path: "card",
  component: emptyRouteComponent
});

const accountingRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "accounting",
  component: emptyRouteComponent
});

const journalEntriesRoute = createRoute({
  getParentRoute: () => accountingRoute,
  path: "journal-entries",
  component: emptyRouteComponent
});

const journalEntryDetailRoute = createRoute({
  getParentRoute: () => journalEntriesRoute,
  path: "$journalEntryId",
  component: emptyRouteComponent
});

const journalEntryEditRoute = createRoute({
  getParentRoute: () => journalEntryDetailRoute,
  path: "edit",
  component: emptyRouteComponent
});

const chartRoute = createRoute({
  getParentRoute: () => accountingRoute,
  path: "chart",
  component: emptyRouteComponent
});

const accountCreateRoute = createRoute({
  getParentRoute: () => chartRoute,
  path: "new",
  component: emptyRouteComponent
});

const accountDetailRoute = createRoute({
  getParentRoute: () => chartRoute,
  path: "$accountId",
  component: emptyRouteComponent
});

const accountEditRoute = createRoute({
  getParentRoute: () => accountDetailRoute,
  path: "edit",
  component: emptyRouteComponent
});

const settingsRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "settings",
  component: emptyRouteComponent
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
