import { SalesInvoicesView } from "../../widgets/sales/SalesInvoicesView";
import { useWorkspaceData } from "../../app/WorkspaceDataContext";

export function SalesPage() {
  const { data, onDataStateChange } = useWorkspaceData();

  return (
    <div className="section-stack">
      <SalesInvoicesView data={data} onDataStateChange={onDataStateChange} />
    </div>
  );
}
