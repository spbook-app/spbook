import { useParams } from "@tanstack/react-router";
import {
  SalesInvoicesView,
  type SalesInvoiceRoute
} from "../../widgets/sales/SalesInvoicesView";
import { useWorkspaceData } from "../../app/WorkspaceDataContext";

export function SalesPage() {
  return <SalesPageContent route={{ mode: "list" }} />;
}

export function SalesInvoiceCreatePage() {
  return <SalesPageContent route={{ mode: "create" }} />;
}

export function SalesInvoiceDetailPage() {
  const { invoiceId } = useParams({ strict: false }) as { invoiceId: string };

  return <SalesPageContent route={{ mode: "detail", invoiceId }} />;
}

export function SalesInvoiceEditPage() {
  const { invoiceId } = useParams({ strict: false }) as { invoiceId: string };

  return <SalesPageContent route={{ mode: "edit", invoiceId }} />;
}

function SalesPageContent({ route }: { route: SalesInvoiceRoute }) {
  const { data, onWorkspaceUpdate } = useWorkspaceData();

  return (
    <div className="section-stack">
      <SalesInvoicesView
        workspace={data.workspace}
        invoices={data.invoices}
        parties={data.parties}
        bankTransactions={data.bankTransactions}
        journalEntries={data.journalEntries}
        bankAccounts={data.bankAccounts}
        accounts={data.accounts}
        onWorkspaceUpdate={onWorkspaceUpdate}
        route={route}
      />
    </div>
  );
}
