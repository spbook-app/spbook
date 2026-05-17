import { BankingAccountsView } from "../../widgets/banking/BankingAccountsView";
import { useWorkspaceData } from "../../app/WorkspaceDataContext";

export function BankingAccountsPage() {
  const { data, onWorkspaceUpdate } = useWorkspaceData();

  return (
    <div className="section-stack">
      <BankingAccountsView
        workspace={data.workspace}
        bankAccounts={data.bankAccounts}
        accounts={data.accounts}
        bankTransactions={data.bankTransactions}
        invoices={data.invoices}
        parties={data.parties}
        supplierInvoices={data.supplierInvoices}
        onWorkspaceUpdate={onWorkspaceUpdate}
      />
    </div>
  );
}
