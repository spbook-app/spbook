import { BankTransactionList } from "../../widgets/banking/BankTransactionList";
import { useWorkspaceData } from "../../app/WorkspaceDataContext";

export function BankingTransactionsPage() {
  const { data, onWorkspaceUpdate } = useWorkspaceData();

  return (
    <div className="section-stack">
      <BankTransactionList
        workspace={data.workspace}
        bankTransactions={data.bankTransactions}
        parties={data.parties}
        accounts={data.accounts}
        invoices={data.invoices}
        supplierInvoices={data.supplierInvoices}
        bankAccounts={data.bankAccounts}
        onWorkspaceUpdate={onWorkspaceUpdate}
      />
    </div>
  );
}
