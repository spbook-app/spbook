import { PurchasesView } from "../../widgets/purchases/PurchasesView";
import { useWorkspaceData } from "../../app/WorkspaceDataContext";

export function PurchasesPage() {
  const { data, onDataStateChange } = useWorkspaceData();

  return (
    <div className="section-stack">
      <PurchasesView
        workspace={data.workspace}
        supplierInvoices={data.supplierInvoices}
        parties={data.parties}
        bankTransactions={data.bankTransactions}
        journalEntries={data.journalEntries}
        accounts={data.accounts}
        onDataStateChange={onDataStateChange}
      />
    </div>
  );
}
