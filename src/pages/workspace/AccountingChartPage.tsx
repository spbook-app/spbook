import { ChartOfAccountsView } from "../../widgets/accounting/AccountingView";
import { useWorkspaceData } from "../../app/WorkspaceDataContext";

export function AccountingChartPage() {
  const { data, onDataStateChange } = useWorkspaceData();

  return (
    <div className="section-stack">
      <ChartOfAccountsView
        workspace={data.workspace}
        accounts={data.accounts}
        journalEntries={data.journalEntries}
        balances={data.balances}
        onDataStateChange={onDataStateChange}
      />
    </div>
  );
}
