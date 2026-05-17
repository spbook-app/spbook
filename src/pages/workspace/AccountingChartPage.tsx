import { useParams } from "@tanstack/react-router";
import {
  ChartOfAccountsView,
  type AccountingRoute
} from "../../widgets/accounting/AccountingView";
import { workspaceRoute } from "../../app/router";

export function AccountingChartPage() {
  return <AccountingChartPageContent route={{ mode: "chart-list" }} />;
}

export function AccountCreatePage() {
  return <AccountingChartPageContent route={{ mode: "account-create" }} />;
}

export function AccountDetailPage() {
  const { accountId } = useParams({ strict: false }) as { accountId: string };

  return <AccountingChartPageContent route={{ mode: "account-detail", accountId }} />;
}

export function AccountEditPage() {
  const { accountId } = useParams({ strict: false }) as { accountId: string };

  return <AccountingChartPageContent route={{ mode: "account-edit", accountId }} />;
}

function AccountingChartPageContent({
  route
}: {
  route: Extract<
    AccountingRoute,
    { mode: "chart-list" | "account-create" | "account-detail" | "account-edit" }
  >;
}) {
  const data = workspaceRoute.useLoaderData();

  return (
    <div className="section-stack">
      <ChartOfAccountsView
        workspace={data.workspace}
        accounts={data.accounts}
        journalEntries={data.journalEntries}
        balances={data.balances}
        parties={data.parties}
        invoices={data.invoices}
        supplierInvoices={data.supplierInvoices}
        bankAccounts={data.bankAccounts}
        route={route}
      />
    </div>
  );
}
