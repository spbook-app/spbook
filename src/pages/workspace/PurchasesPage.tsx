import { useParams } from "@tanstack/react-router";
import {
  PurchasesView,
  type PurchaseRoute
} from "../../widgets/purchases/PurchasesView";
import { workspaceRoute } from "../../app/router";

export function PurchasesPage() {
  return <PurchasesPageContent route={{ mode: "supplier-list" }} />;
}

export function SupplierInvoiceCreatePage() {
  return <PurchasesPageContent route={{ mode: "supplier-create" }} />;
}

export function SupplierInvoiceDetailPage() {
  const { supplierInvoiceId } = useParams({ strict: false }) as {
    supplierInvoiceId: string;
  };

  return <PurchasesPageContent route={{ mode: "supplier-detail", supplierInvoiceId }} />;
}

export function SupplierInvoiceEditPage() {
  const { supplierInvoiceId } = useParams({ strict: false }) as {
    supplierInvoiceId: string;
  };

  return <PurchasesPageContent route={{ mode: "supplier-edit", supplierInvoiceId }} />;
}

export function OwnerTransactionCreatePage() {
  return <PurchasesPageContent route={{ mode: "owner-create" }} />;
}

function PurchasesPageContent({ route }: { route: PurchaseRoute }) {
  const data = workspaceRoute.useLoaderData();

  return (
    <div className="section-stack">
      <PurchasesView
        workspace={data.workspace}
        supplierInvoices={data.supplierInvoices}
        parties={data.parties}
        bankTransactions={data.bankTransactions}
        journalEntries={data.journalEntries}
        accounts={data.accounts}
        route={route}
      />
    </div>
  );
}
