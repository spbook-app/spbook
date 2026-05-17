import { useParams } from "@tanstack/react-router";
import {
  BankTransactionList,
  type BankTransactionRoute
} from "../../widgets/banking/BankTransactionList";
import { workspaceRoute } from "../../app/router";

export function BankingTransactionsPage() {
  return <BankingTransactionsPageContent route={{ mode: "list" }} />;
}

export function BankingTransactionCreatePage() {
  return <BankingTransactionsPageContent route={{ mode: "create" }} />;
}

export function BankingTransactionDetailPage() {
  const { bankTransactionId } = useParams({ strict: false }) as {
    bankTransactionId: string;
  };

  return <BankingTransactionsPageContent route={{ mode: "detail", bankTransactionId }} />;
}

export function BankingTransactionEditPage() {
  const { bankTransactionId } = useParams({ strict: false }) as {
    bankTransactionId: string;
  };

  return <BankingTransactionsPageContent route={{ mode: "edit", bankTransactionId }} />;
}

function BankingTransactionsPageContent({ route }: { route: BankTransactionRoute }) {
  const data = workspaceRoute.useLoaderData();

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
        route={route}
      />
    </div>
  );
}
