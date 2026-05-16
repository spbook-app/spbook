import { useMemo } from "react";
import { useRouterState } from "@tanstack/react-router";
import { BalancesTable } from "../entities/account/BalancesTable";
import { JournalEntriesPanel } from "../entities/journal/JournalEntriesPanel";
import {
  getWorkspaceSectionFromPath,
  getSectionLead,
  workspaceSections
} from "../pages/workspace/model";
import { AccountsTable } from "../widgets/accounting/AccountsTable";
import { BankingPanel } from "../widgets/banking/BankingPanel";
import { CounterpartiesPanel } from "../widgets/counterparties/CounterpartiesPanel";
import { DashboardView } from "../widgets/dashboard/DashboardView";
import { OwnerTransactionsPanel } from "../widgets/purchases/OwnerTransactionsPanel";
import { SupplierInvoiceWorkflowPanel } from "../widgets/purchases/SupplierInvoiceWorkflowPanel";
import { SalesInvoicesView } from "../widgets/sales/SalesInvoicesView";
import { SettingsPanel } from "../widgets/settings/SettingsPanel";
import { WorkspaceSidebar } from "../widgets/workspace-sidebar/WorkspaceSidebar";
import type { AppDataState } from "./App";

export function WorkspaceView({
  data,
  onDataStateChange,
  showReset
}: {
  data: Extract<AppDataState, { state: "ready" }>;
  onDataStateChange: (state: AppDataState) => void;
  showReset: boolean;
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname
  });
  const activeSection = getWorkspaceSectionFromPath(pathname);
  const accountNames = useMemo(
    () => new Map(data.accounts.map((account) => [account.code, account.name])),
    [data.accounts]
  );
  const activeSectionMeta =
    workspaceSections.find((section) => section.id === activeSection) ??
    workspaceSections[0]!;

  return (
    <div className="workspace-layout">
      <WorkspaceSidebar
        activeSection={activeSection}
        data={data}
        onDataStateChange={onDataStateChange}
      />
      <section className="workspace-main" aria-label={activeSectionMeta.label}>
        <header className="page-heading">
          <p className="eyebrow">{activeSectionMeta.label}</p>
          <h1>{activeSectionMeta.description}</h1>
          <p>{getSectionLead(activeSection)}</p>
        </header>

        {activeSection === "dashboard" ? <DashboardView data={data} accountNames={accountNames} /> : null}
        {activeSection === "sales" ? (
          <div className="section-stack">
            <SalesInvoicesView data={data} onDataStateChange={onDataStateChange} />
          </div>
        ) : null}
        {activeSection === "purchases" ? (
          <div className="section-stack">
            <SupplierInvoiceWorkflowPanel
              data={data}
              onDataStateChange={onDataStateChange}
            />
            <OwnerTransactionsPanel data={data} onDataStateChange={onDataStateChange} />
          </div>
        ) : null}
        {activeSection === "banking" ? (
          <div className="section-stack">
            <BankingPanel data={data} onDataStateChange={onDataStateChange} />
          </div>
        ) : null}
        {activeSection === "counterparties" ? (
          <div className="section-stack">
            <CounterpartiesPanel data={data} onDataStateChange={onDataStateChange} />
          </div>
        ) : null}
        {activeSection === "accounting" ? (
          <div className="section-stack">
            <BalancesTable balances={data.balances} accountNames={accountNames} />
            <JournalEntriesPanel entries={data.journalEntries} />
            <AccountsTable data={data} onDataStateChange={onDataStateChange} />
          </div>
        ) : null}
        {activeSection === "settings" ? (
          <SettingsPanel
            data={data}
            onDataStateChange={onDataStateChange}
            showReset={showReset}
          />
        ) : null}
      </section>
    </div>
  );
}
