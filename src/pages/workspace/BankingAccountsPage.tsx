import { useParams } from "@tanstack/react-router";
import {
  BankingAccountsView,
  type BankingAccountRoute
} from "../../widgets/banking/BankingAccountsView";
import { workspaceRoute } from "../../app/router";

export function BankingAccountsPage() {
  return <BankingAccountsPageContent route={{ mode: "list" }} />;
}

export function BankingAccountCreatePage() {
  return <BankingAccountsPageContent route={{ mode: "create" }} />;
}

export function BankingAccountDetailPage() {
  const { bankAccountId } = useParams({ strict: false }) as { bankAccountId: string };

  return <BankingAccountsPageContent route={{ mode: "workspace", bankAccountId }} />;
}

export function BankingAccountCardPage() {
  const { bankAccountId } = useParams({ strict: false }) as { bankAccountId: string };

  return <BankingAccountsPageContent route={{ mode: "card", bankAccountId }} />;
}

export function BankingAccountEditPage() {
  const { bankAccountId } = useParams({ strict: false }) as { bankAccountId: string };

  return <BankingAccountsPageContent route={{ mode: "edit", bankAccountId }} />;
}

function BankingAccountsPageContent({ route }: { route: BankingAccountRoute }) {
  const data = workspaceRoute.useLoaderData();

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
        route={route}
      />
    </div>
  );
}
