import { BankingAccountsView } from "../../widgets/banking/BankingAccountsView";
import { useWorkspaceData } from "../../app/WorkspaceDataContext";

export function BankingAccountsPage() {
  const { data, onDataStateChange } = useWorkspaceData();

  return (
    <div className="section-stack">
      <BankingAccountsView
        workspace={data.workspace}
        bankAccounts={data.bankAccounts}
        accounts={data.accounts}
        bankTransactions={data.bankTransactions}
        parties={data.parties}
        onDataStateChange={onDataStateChange}
      />
    </div>
  );
}
