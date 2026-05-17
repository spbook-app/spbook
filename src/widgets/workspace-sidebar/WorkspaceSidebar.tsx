import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import type { Account, BankTransaction, Invoice, SupplierInvoice, Workspace } from "../../domain";
import type { WorkspaceSidebarProps } from "../../shared/model/widget-props";
import {
  type WorkspaceSection,
  workspaceSections
} from "../../pages/workspace/model";
import { clearDatabase } from "../../storage/repositories";

export function WorkspaceSidebar(props: WorkspaceSidebarProps) {
  const { workspace, invoices, supplierInvoices, bankTransactions, activeSection } = props;
  const openItems =
    invoices.filter((invoice) => invoice.status !== "paid").length +
    supplierInvoices.filter((supplierInvoice) => supplierInvoice.status !== "paid").length +
    bankTransactions.filter((bankTransaction) => bankTransaction.status === "unmatched").length;

  return (
    <aside className="workspace-sidebar" aria-label="Workspace navigation">
      <div className="sidebar-workspace-summary">
        <strong>{workspace.name}</strong>
        <span>{openItems} open</span>
      </div>

      <nav className="sidebar-nav" aria-label="Workspace sections">
        {workspaceSections.map((section) => {
          const sectionCount = getSectionOpenCount(section.id, {
            invoices,
            supplierInvoices,
            bankTransactions
          });

          return (
            <Link
              aria-label={section.label}
              className={`nav-item ${activeSection === section.id ? "nav-item-active" : ""}`}
              key={section.id}
              title={section.description}
              to={section.path}
            >
              <span className="nav-key" aria-hidden="true">
                {getSectionAbbreviation(section.label)}
              </span>
              <span className="nav-label">{section.label}</span>
              {sectionCount > 0 ? <small>{sectionCount}</small> : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function getSectionOpenCount(
  sectionId: WorkspaceSection,
  data: {
    invoices: Invoice[];
    supplierInvoices: SupplierInvoice[];
    bankTransactions: BankTransaction[];
  }
) {
  switch (sectionId) {
    case "sales":
      return data.invoices.filter((invoice) => invoice.status !== "paid").length;
    case "purchases":
      return data.supplierInvoices.filter(
        (supplierInvoice) => supplierInvoice.status !== "paid"
      ).length;
    case "bank-transactions":
      return data.bankTransactions.filter(
        (bankTransaction) => bankTransaction.status === "unmatched"
      ).length;
    default:
      return 0;
  }
}

function getSectionAbbreviation(label: string) {
  return label.slice(0, 2).toUpperCase();
}

export function WorkspaceStatusCard({
  workspace,
  accounts,
  initializedWorkspace,
  showReset
}: {
  workspace: Workspace;
  accounts: Account[];
  initializedWorkspace: boolean;
  showReset: boolean;
}) {
  const [resetState, setResetState] = useState<"idle" | "resetting">("idle");
  const router = useRouter();

  async function handleReset() {
    setResetState("resetting");

    try {
      await clearDatabase();
      await router.invalidate();
    } catch (error) {
      console.error("Reset failed:", error);
    } finally {
      setResetState("idle");
    }
  }

  return (
    <div className="sidebar-status-card">
      <dl className="sidebar-details">
        <div>
          <dt>Country</dt>
          <dd>{workspace.countryCode}</dd>
        </div>
        <div>
          <dt>Storage</dt>
          <dd>{initializedWorkspace ? "Created locally" : "Loaded locally"}</dd>
        </div>
        <div>
          <dt>Accounts</dt>
          <dd>{accounts.length}</dd>
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
