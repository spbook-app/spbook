import { useState } from "react";
import type { AppDataState } from "../../app/App";
import {
  type WorkspaceSection,
  workspaceSections
} from "../../pages/workspace/model";
import { initializeDefaultWorkspace } from "../../storage/initialize-workspace";
import { clearDatabase } from "../../storage/repositories";
import { loadWorkspaceOverview } from "../../services/workspace-overview";

export function WorkspaceSidebar({
  activeSection,
  data,
  onDataStateChange,
  onSectionChange
}: {
  activeSection: WorkspaceSection;
  data: Extract<AppDataState, { state: "ready" }>;
  onDataStateChange: (state: AppDataState) => void;
  onSectionChange: (section: WorkspaceSection) => void;
}) {
  const openItems =
    data.invoices.filter((invoice) => invoice.status !== "paid").length +
    data.supplierInvoices.filter((supplierInvoice) => supplierInvoice.status !== "paid").length +
    data.bankTransactions.filter((bankTransaction) => bankTransaction.status === "unmatched").length;

  return (
    <aside className="workspace-sidebar" aria-label="Workspace navigation">
      <div>
        <p className="eyebrow">Workspace</p>
        <h2>{data.workspace.name}</h2>
        <dl className="sidebar-details compact-sidebar-details">
          <div>
            <dt>Currency</dt>
            <dd>{data.workspace.baseCurrency}</dd>
          </div>
          <div>
            <dt>Open work</dt>
            <dd>{openItems}</dd>
          </div>
        </dl>
      </div>

      <nav className="sidebar-nav" aria-label="Workspace sections">
        {workspaceSections.map((section) => (
          <button
            className={`nav-item ${activeSection === section.id ? "nav-item-active" : ""}`}
            key={section.id}
            type="button"
            onClick={() => onSectionChange(section.id)}
          >
            <span>{section.label}</span>
            <small>{section.description}</small>
          </button>
        ))}
      </nav>

      <WorkspaceStatusCard
        data={data}
        onDataStateChange={onDataStateChange}
        showReset={false}
      />
    </aside>
  );
}

export function WorkspaceStatusCard({
  data,
  onDataStateChange,
  showReset
}: {
  data: Extract<AppDataState, { state: "ready" }>;
  onDataStateChange: (state: AppDataState) => void;
  showReset: boolean;
}) {
  const [resetState, setResetState] = useState<"idle" | "resetting">("idle");

  async function handleReset() {
    setResetState("resetting");

    try {
      await clearDatabase();
      const initialization = await initializeDefaultWorkspace();
      const overview = await loadWorkspaceOverview(initialization.workspace.id);

      onDataStateChange({
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
    } catch (error) {
      onDataStateChange({
        state: "error",
        message: error instanceof Error ? error.message : "Unknown reset error"
      });
    } finally {
      setResetState("idle");
    }
  }

  return (
    <div className="sidebar-status-card">
      <dl className="sidebar-details">
        <div>
          <dt>Country</dt>
          <dd>{data.workspace.countryCode}</dd>
        </div>
        <div>
          <dt>Storage</dt>
          <dd>{data.initializedWorkspace ? "Created locally" : "Loaded locally"}</dd>
        </div>
        <div>
          <dt>Accounts</dt>
          <dd>{data.accounts.length}</dd>
        </div>
      </dl>
      <div className="sidebar-note compact-note">
        <strong>Offline-first</strong>
        <span>Data shown here is backed by IndexedDB in this browser.</span>
      </div>
      {showReset ? (
        <button
          className="secondary-button"
          type="button"
          disabled={resetState === "resetting"}
          onClick={() => void handleReset()}
        >
          {resetState === "resetting" ? "Resetting" : "Reset local data"}
        </button>
      ) : null}
    </div>
  );
}
