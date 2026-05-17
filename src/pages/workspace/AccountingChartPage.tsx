import { ChartOfAccountsView } from "../../widgets/accounting/AccountingView";
import { useWorkspaceData } from "../../app/WorkspaceDataContext";

export function AccountingChartPage() {
  const { data, onDataStateChange } = useWorkspaceData();

  return (
    <div className="section-stack">
      <ChartOfAccountsView data={data} onDataStateChange={onDataStateChange} />
    </div>
  );
}
