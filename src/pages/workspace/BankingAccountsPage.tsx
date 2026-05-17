import { BankingAccountsView } from "../../widgets/banking/BankingAccountsView";
import { useWorkspaceData } from "../../app/WorkspaceDataContext";

export function BankingAccountsPage() {
  const { data, onDataStateChange } = useWorkspaceData();

  return (
    <div className="section-stack">
      <BankingAccountsView data={data} onDataStateChange={onDataStateChange} />
    </div>
  );
}
