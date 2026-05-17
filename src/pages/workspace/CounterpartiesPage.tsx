import { CounterpartiesView } from "../../widgets/counterparties/CounterpartiesView";
import { useWorkspaceData } from "../../app/WorkspaceDataContext";

export function CounterpartiesPage() {
  const { data, onDataStateChange } = useWorkspaceData();

  return (
    <div className="section-stack">
      <CounterpartiesView
        workspace={data.workspace}
        parties={data.parties}
        invoices={data.invoices}
        supplierInvoices={data.supplierInvoices}
        onDataStateChange={onDataStateChange}
      />
    </div>
  );
}
