import { PurchasesView } from "../../widgets/purchases/PurchasesView";
import { useWorkspaceData } from "../../app/WorkspaceDataContext";

export function PurchasesPage() {
  const { data, onDataStateChange } = useWorkspaceData();

  return (
    <div className="section-stack">
      <PurchasesView data={data} onDataStateChange={onDataStateChange} />
    </div>
  );
}
