import type { WorkspaceOverview } from "../../services/workspace-overview";

export function mapOverviewToReadyState(overview: WorkspaceOverview) {
  return {
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
