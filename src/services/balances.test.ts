import { describe, expect, it } from "vitest";
import type { JournalEntry } from "../domain";
import { calculateAccountBalances, formatMinorUnits } from "./balances";

const entries: JournalEntry[] = [
  {
    id: "je_invoice",
    workspaceId: "ws_demo",
    entryDate: "2026-04-01",
    sourceType: "invoice",
    sourceId: "inv_demo",
    description: "Invoice issued",
    lines: [
      {
        accountCode: "1200",
        side: "debit",
        amount: "1000.00",
        currency: "EUR"
      },
      {
        accountCode: "7600",
        side: "credit",
        amount: "1000.00",
        currency: "EUR"
      }
    ]
  },
  {
    id: "je_payment",
    workspaceId: "ws_demo",
    entryDate: "2026-04-02",
    sourceType: "invoice_payment",
    sourceId: "inv_demo",
    description: "Invoice paid",
    lines: [
      {
        accountCode: "1100",
        side: "debit",
        amount: "1000.00",
        currency: "EUR"
      },
      {
        accountCode: "1200",
        side: "credit",
        amount: "1000.00",
        currency: "EUR"
      }
    ]
  }
];

describe("calculateAccountBalances", () => {
  it("calculates balances from invoice and payment entries", () => {
    expect(calculateAccountBalances(entries)).toEqual([
      {
        accountCode: "1100",
        currency: "EUR",
        minorUnits: 100000n,
        amount: "1000.00"
      },
      {
        accountCode: "1200",
        currency: "EUR",
        minorUnits: 0n,
        amount: "0.00"
      },
      {
        accountCode: "7600",
        currency: "EUR",
        minorUnits: -100000n,
        amount: "-1000.00"
      }
    ]);
  });

  it("formats negative minor units", () => {
    expect(formatMinorUnits(-12345n)).toBe("-123.45");
  });
});
