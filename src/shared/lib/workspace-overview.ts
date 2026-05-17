import type { WorkspaceOverview } from "../../services/workspace-overview";
import type { AppDataState, ReadyWorkspaceData, WorkspaceDataUpdate } from "../model/workspace";

export function mapOverviewToReadyState(overview: WorkspaceOverview) {
  return {
    state: "ready" as const,
    workspace: overview.workspace,
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
    balances: overview.balances
  };
}

/**
 * Merges a granular workspace update into the existing ready state.
 * Only the slices present in `update` are replaced; everything else
 * (including `workspace` and `initializedWorkspace`) is preserved.
 */
export function applyWorkspaceUpdate(
  data: ReadyWorkspaceData,
  update: WorkspaceDataUpdate
): AppDataState {
  return { state: "ready", ...data, ...update };
}
