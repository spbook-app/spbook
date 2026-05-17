import { useMemo } from "react";
import { DashboardView } from "../../widgets/dashboard/DashboardView";
import { workspaceRoute } from "../../app/router";

export function DashboardPage() {
  const data = workspaceRoute.useLoaderData();
  const accountNames = useMemo(
    () => new Map(data.accounts.map((account) => [account.code, account.name])),
    [data.accounts]
  );

  return (
    <DashboardView
      workspace={data.workspace}
      invoices={data.invoices}
      supplierInvoices={data.supplierInvoices}
      bankTransactions={data.bankTransactions}
      journalEntries={data.journalEntries}
      accounts={data.accounts}
      balances={data.balances}
      accountNames={accountNames}
    />
  );
}
