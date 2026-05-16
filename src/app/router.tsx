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

const bankingRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "banking",
  component: emptyRouteComponent
});

const counterpartiesRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "counterparties",
  component: emptyRouteComponent
});

const accountingRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "accounting",
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
    purchasesRoute,
    bankingRoute,
    counterpartiesRoute,
    accountingRoute,
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
