import type { MoneyAmount } from "./entities";

export type MoneyAmountParseResult =
  | {
      ok: true;
      minorUnits: bigint;
    }
  | {
      ok: false;
      reason: "invalid_format" | "not_positive";
    };

const MONEY_PATTERN = /^(?<whole>\d+)(?:\.(?<fraction>\d{1,2}))?$/;

export function parseMoneyAmount(amount: MoneyAmount): MoneyAmountParseResult {
  const match = MONEY_PATTERN.exec(amount);

  if (!match?.groups) {
    return { ok: false, reason: "invalid_format" };
  }

  const wholeText = match.groups.whole;

  if (!wholeText) {
    return { ok: false, reason: "invalid_format" };
  }

  const whole = BigInt(wholeText);
  const fraction = BigInt((match.groups.fraction ?? "").padEnd(2, "0"));
  const minorUnits = whole * 100n + fraction;

  if (minorUnits <= 0n) {
    return { ok: false, reason: "not_positive" };
  }

  return { ok: true, minorUnits };
}

export function compareMinorUnits(left: bigint, right: bigint) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function addMinorUnits(values: bigint[]) {
  return values.reduce((total, value) => total + value, 0n);
}
