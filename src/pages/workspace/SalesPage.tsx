import { SalesInvoicesView } from "../../widgets/sales/SalesInvoicesView";
import { useWorkspaceData } from "../../app/WorkspaceDataContext";

export function SalesPage() {
  const { data, onWorkspaceUpdate } = useWorkspaceData();

  return (
    <div className="section-stack">
      <SalesInvoicesView
        workspace={data.workspace}
        invoices={data.invoices}
        parties={data.parties}
        bankTransactions={data.bankTransactions}
        journalEntries={data.journalEntries}
        bankAccounts={data.bankAccounts}
        accounts={data.accounts}
        onWorkspaceUpdate={onWorkspaceUpdate}
      />
    </div>
  );
}
