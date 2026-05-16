import type { AppDataState } from "../../app/App";
import { BankAccountsPanel } from "./BankAccountsPanel";
import { BankStatementImport } from "./BankStatementImport";
import { BankTransactionList } from "./BankTransactionList";

export function BankingPanel({
  data,
  onDataStateChange
}: {
  data: Extract<AppDataState, { state: "ready" }>;
  onDataStateChange: (state: AppDataState) => void;
}) {
  return (
    <section className="panel panel-wide" aria-labelledby="banking-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Banking</p>
          <h2 id="banking-title">Bank accounts and transactions</h2>
        </div>
        <span>
          {data.bankAccounts.length} accounts · {data.bankTransactions.length} transactions
        </span>
      </div>

      <BankAccountsPanel data={data} onDataStateChange={onDataStateChange} />
      <BankStatementImport data={data} onDataStateChange={onDataStateChange} />
      <BankTransactionList data={data} onDataStateChange={onDataStateChange} />
    </section>
  );
}
