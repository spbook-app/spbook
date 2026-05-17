import { BankTransactionList } from "../../widgets/banking/BankTransactionList";
import { useWorkspaceData } from "../../app/WorkspaceDataContext";

export function BankingTransactionsPage() {
  const { data, onDataStateChange } = useWorkspaceData();

  return (
    <div className="section-stack">
      <BankTransactionList data={data} onDataStateChange={onDataStateChange} />
    </div>
  );
}
