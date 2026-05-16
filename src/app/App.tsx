import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
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
import { buildInfo } from "../generated/build-info";
import type { AccountBalance } from "../services/balances";
import { loadWorkspaceOverview } from "../services/workspace-overview";
import { initializeDefaultWorkspace } from "../storage/initialize-workspace";
import { appMeta } from "./app-meta";
import { WorkspaceView } from "./WorkspaceView";
import {
  formatAppBuildLabel,
  getAppEnvironment,
  getAppEnvironmentLabel,
  shouldShowEnvironmentBadge
} from "./app-env";

export type AppDataState =
  | {
      state: "loading";
    }
  | {
      state: "ready";
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
      initializedWorkspace: boolean;
    }
  | {
      state: "error";
      message: string;
    };

export function App() {
  const appEnvironment = getAppEnvironment();
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname
  });
  const [dataState, setDataState] = useState<AppDataState>({ state: "loading" });

  useEffect(() => {
    if (pathname === "/" || pathname === "/workspace" || pathname === "/workspace/") {
      void navigate({ to: "/workspace/dashboard", replace: true });
    }

    if (pathname === "/workspace/sales" || pathname === "/workspace/sales/") {
      void navigate({ to: "/workspace/sales/invoices", replace: true });
    }

    if (pathname === "/workspace/banking" || pathname === "/workspace/banking/") {
      void navigate({ to: "/workspace/banking/accounts", replace: true });
    }
  }, [navigate, pathname]);

  useEffect(() => {
    let cancelled = false;

    initializeDefaultWorkspace()
      .then(async (initialization) => {
        const overview = await loadWorkspaceOverview(initialization.workspace.id);

        if (cancelled) return;

        setDataState({
          state: "ready",
          workspace: initialization.workspace,
          accounts: overview.accounts,
          bankAccounts: overview.bankAccounts,
          bankTransactions: overview.bankTransactions,
          parties: overview.parties,
          invoices: overview.invoices,
          invoice: overview.latestInvoice,
          invoiceParty: overview.latestInvoiceParty,
          supplierInvoices: overview.supplierInvoices,
          supplierInvoice: overview.latestSupplierInvoice,
          supplierInvoiceParty: overview.latestSupplierInvoiceParty,
          journalEntries: overview.journalEntries,
          balances: overview.balances,
          initializedWorkspace: initialization.created
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;

        setDataState({
          state: "error",
          message: error instanceof Error ? error.message : "Unknown app error"
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="app-root">
      <header className="topbar">
        <div>
          <span className="brand-mark">SB</span>
          <span className="brand-name">{appMeta.name}</span>
        </div>
        {shouldShowEnvironmentBadge(appEnvironment) ? (
          <span className="environment-badge">
            {getAppEnvironmentLabel(appEnvironment)} · {formatAppBuildLabel(buildInfo)}
          </span>
        ) : null}
      </header>

      {dataState.state === "loading" ? <LoadingView /> : null}
      {dataState.state === "error" ? <ErrorView message={dataState.message} /> : null}
      {dataState.state === "ready" ? (
        <WorkspaceView
          data={dataState}
          onDataStateChange={setDataState}
          showReset={shouldShowEnvironmentBadge(appEnvironment)}
        />
      ) : null}
    </main>
  );
}

function LoadingView() {
  return (
    <section className="state-panel" aria-live="polite">
      <p className="eyebrow">Loading</p>
      <h1>Initializing local workspace</h1>
      <p>Opening IndexedDB, checking workspace data, and preparing local records.</p>
    </section>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <section className="state-panel error-panel" role="alert">
      <p className="eyebrow">Error</p>
      <h1>Local workspace failed</h1>
      <p>{message}</p>
    </section>
  );
}
