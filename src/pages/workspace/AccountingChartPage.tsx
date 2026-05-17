import { ChartOfAccountsView } from "../../widgets/accounting/AccountingView";
import { useWorkspaceData } from "../../app/WorkspaceDataContext";

export function AccountingChartPage() {
  const { data, onWorkspaceUpdate } = useWorkspaceData();

  return (
    <div className="section-stack">
      <ChartOfAccountsView
        workspace={data.workspace}
        accounts={data.accounts}
        journalEntries={data.journalEntries}
        balances={data.balances}
        parties={data.parties}
        invoices={data.invoices}
        supplierInvoices={data.supplierInvoices}
        bankAccounts={data.bankAccounts}
        onWorkspaceUpdate={onWorkspaceUpdate}
      />
    </div>
  );
}
