import { CounterpartiesView } from "../../widgets/counterparties/CounterpartiesView";
import { useWorkspaceData } from "../../app/WorkspaceDataContext";

export function CounterpartiesPage() {
  const { data, onDataStateChange } = useWorkspaceData();

  return (
    <div className="section-stack">
      <CounterpartiesView data={data} onDataStateChange={onDataStateChange} />
    </div>
  );
}
