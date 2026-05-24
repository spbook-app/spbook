import { Link } from "@tanstack/react-router";
import type { AccountBalance } from "../../services/balances";

export function BalancesTable({
  balances,
  accountNames,
  accountIds,
}: {
  balances: AccountBalance[];
  accountNames: Map<string, string>;
  accountIds?: Map<string, string>;
}) {
  return (
    <section className="panel" aria-labelledby="balances-title">
      <div className="panel-header">
        <h2 id="balances-title">Raw account balances</h2>
      </div>
      <div className="balance-list">
        {balances.length === 0 ? <p className="empty-state">No balances yet.</p> : null}
        {balances.map((balance) => {
          const accountId = accountIds?.get(balance.accountCode);
          const inner = (
            <>
              <div>
                <span className="code-cell">{balance.accountCode}</span>
                <small>{accountNames.get(balance.accountCode) ?? "Unknown account"}</small>
              </div>
              <strong>
                {balance.amount} {balance.currency}
              </strong>
            </>
          );

          if (accountId) {
            return (
              <Link
                className="balance-row balance-row--link"
                key={`${balance.accountCode}:${balance.currency}`}
                to="/workspace/accounting/chart/$accountId"
                params={{ accountId }}
              >
                {inner}
              </Link>
            );
          }

          return (
            <div className="balance-row" key={`${balance.accountCode}:${balance.currency}`}>
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}
