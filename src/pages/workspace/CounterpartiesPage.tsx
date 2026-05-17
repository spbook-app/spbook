import { CounterpartiesView } from "../../widgets/counterparties/CounterpartiesView";
import { useWorkspaceData } from "../../app/WorkspaceDataContext";

export function CounterpartiesPage() {
  const { data, onWorkspaceUpdate } = useWorkspaceData();

  return (
    <div className="section-stack">
      <CounterpartiesView
        workspace={data.workspace}
        parties={data.parties}
        invoices={data.invoices}
        supplierInvoices={data.supplierInvoices}
        bankAccounts={data.bankAccounts}
        onWorkspaceUpdate={onWorkspaceUpdate}
      />
    </div>
  );
}
