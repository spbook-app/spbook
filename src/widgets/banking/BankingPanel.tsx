import type { AppDataState } from "../../app/App";
import { useRouterState } from "@tanstack/react-router";
import { BankingAccountsView } from "./BankingAccountsView";
import { BankStatementImport } from "./BankStatementImport";
import { BankTransactionList } from "./BankTransactionList";

export function BankingPanel({
  data,
  onDataStateChange
}: {
  data: Extract<AppDataState, { state: "ready" }>;
  onDataStateChange: (state: AppDataState) => void;
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname
  });

  if (pathname.startsWith("/workspace/banking/accounts")) {
    return <BankingAccountsView data={data} onDataStateChange={onDataStateChange} />;
  }

  if (pathname.startsWith("/workspace/banking/transactions")) {
    return (
      <section className="panel panel-wide" aria-label="Bank transactions">
        {pathname === "/workspace/banking/transactions" ? (
          <BankStatementImport data={data} onDataStateChange={onDataStateChange} />
        ) : null}
        <BankTransactionList data={data} onDataStateChange={onDataStateChange} />
      </section>
    );
  }

  return (
    <section className="panel panel-wide" aria-label="Banking">
      <div className="panel-actions">
        <span>
          {data.bankAccounts.length} accounts · {data.bankTransactions.length} transactions
        </span>
      </div>

      <BankStatementImport data={data} onDataStateChange={onDataStateChange} />
      <BankTransactionList data={data} onDataStateChange={onDataStateChange} />
    </section>
  );
}
