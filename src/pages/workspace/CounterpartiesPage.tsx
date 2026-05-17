import { useParams } from "@tanstack/react-router";
import {
  CounterpartiesView,
  type CounterpartyRoute
} from "../../widgets/counterparties/CounterpartiesView";
import { workspaceRoute } from "../../app/router";

export function CounterpartiesPage() {
  return <CounterpartiesPageContent route={{ mode: "list" }} />;
}

export function CounterpartyCreatePage() {
  return <CounterpartiesPageContent route={{ mode: "create" }} />;
}

export function CounterpartyDetailPage() {
  const { partyId } = useParams({ strict: false }) as { partyId: string };

  return <CounterpartiesPageContent route={{ mode: "workspace", partyId }} />;
}

export function CounterpartyCardPage() {
  const { partyId } = useParams({ strict: false }) as { partyId: string };

  return <CounterpartiesPageContent route={{ mode: "card", partyId }} />;
}

export function CounterpartyEditPage() {
  const { partyId } = useParams({ strict: false }) as { partyId: string };

  return <CounterpartiesPageContent route={{ mode: "edit", partyId }} />;
}

function CounterpartiesPageContent({ route }: { route: CounterpartyRoute }) {
  const data = workspaceRoute.useLoaderData();

  return (
    <div className="section-stack">
      <CounterpartiesView
        workspace={data.workspace}
        parties={data.parties}
        invoices={data.invoices}
        supplierInvoices={data.supplierInvoices}
        bankAccounts={data.bankAccounts}
        route={route}
      />
    </div>
  );
}
