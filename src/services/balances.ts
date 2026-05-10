import type { JournalEntry } from "../domain";
import { parseMoneyAmount } from "../domain";

export type AccountBalance = {
  accountCode: string;
  currency: string;
  minorUnits: bigint;
  amount: string;
};

export function calculateAccountBalances(entries: JournalEntry[]): AccountBalance[] {
  const balances = new Map<string, AccountBalance>();

  for (const entry of entries) {
    for (const line of entry.lines) {
      const parsed = parseMoneyAmount(line.amount);

      if (!parsed.ok) {
        throw new Error(`Invalid journal line amount: ${line.amount}`);
      }

      const key = `${line.accountCode}:${line.currency}`;
      const existing =
        balances.get(key) ??
        ({
          accountCode: line.accountCode,
          currency: line.currency,
          minorUnits: 0n,
          amount: "0.00"
        } satisfies AccountBalance);
      const delta = line.side === "debit" ? parsed.minorUnits : -parsed.minorUnits;
      const minorUnits = existing.minorUnits + delta;

      balances.set(key, {
        ...existing,
        minorUnits,
        amount: formatMinorUnits(minorUnits)
      });
    }
  }

  return [...balances.values()].sort((left, right) =>
    left.accountCode.localeCompare(right.accountCode)
  );
}

export function formatMinorUnits(minorUnits: bigint) {
  const sign = minorUnits < 0n ? "-" : "";
  const absolute = minorUnits < 0n ? -minorUnits : minorUnits;
  const whole = absolute / 100n;
  const fraction = `${absolute % 100n}`.padStart(2, "0");

  return `${sign}${whole}.${fraction}`;
}
