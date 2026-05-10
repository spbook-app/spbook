import { describe, expect, it } from "vitest";
import type { Account, JournalEntry } from "./entities";
import { validateJournalEntry } from "./journal";

const accounts: Account[] = [
  {
    id: "acc_12",
    workspaceId: "ws_demo",
    code: "12",
    name: "Trade receivables",
    role: "group",
    active: true
  },
  {
    id: "acc_1200",
    workspaceId: "ws_demo",
    code: "1200",
    parentCode: "12",
    name: "Receivables from customers",
    role: "posting",
    active: true
  },
  {
    id: "acc_7600",
    workspaceId: "ws_demo",
    code: "7600",
    name: "Service revenue",
    role: "posting",
    active: true
  }
];

const balancedEntry: JournalEntry = {
  id: "je_2026_0001",
  workspaceId: "ws_demo",
  entryDate: "2026-04-01",
  sourceType: "invoice",
  sourceId: "inv_2026_0001",
  description: "Invoice issued",
  lines: [
    {
      accountCode: "1200",
      side: "debit",
      amount: "1000.00",
      currency: "EUR",
      partyId: "party_001",
      invoiceId: "inv_2026_0001"
    },
    {
      accountCode: "7600",
      side: "credit",
      amount: "1000.00",
      currency: "EUR",
      partyId: "party_001"
    }
  ]
};

function issueCodes(entry: JournalEntry) {
  const result = validateJournalEntry(entry, accounts);
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe("validateJournalEntry", () => {
  it("passes a balanced invoice journal entry", () => {
    expect(validateJournalEntry(balancedEntry, accounts)).toEqual({ ok: true });
  });

  it("fails an unbalanced journal entry", () => {
    expect(
      issueCodes({
        ...balancedEntry,
        lines: [
          balancedEntry.lines[0]!,
          { ...balancedEntry.lines[1]!, amount: "900.00" }
        ]
      })
    ).toContain("journal.unbalanced");
  });

  it("fails a one-line journal entry", () => {
    expect(issueCodes({ ...balancedEntry, lines: [balancedEntry.lines[0]!] })).toContain(
      "journal.too_few_lines"
    );
  });

  it("fails when a line references a missing account", () => {
    expect(
      issueCodes({
        ...balancedEntry,
        lines: [
          { ...balancedEntry.lines[0]!, accountCode: "9999" },
          balancedEntry.lines[1]!
        ]
      })
    ).toContain("journal.account_missing");
  });

  it("fails when a line references a group account", () => {
    expect(
      issueCodes({
        ...balancedEntry,
        lines: [
          { ...balancedEntry.lines[0]!, accountCode: "12" },
          balancedEntry.lines[1]!
        ]
      })
    ).toContain("journal.account_not_posting");
  });

  it("fails when a line references both invoice and supplier invoice", () => {
    expect(
      issueCodes({
        ...balancedEntry,
        lines: [
          {
            ...balancedEntry.lines[0]!,
            supplierInvoiceId: "bill_2026_0001"
          },
          balancedEntry.lines[1]!
        ]
      })
    ).toContain("journal.line_conflicting_documents");
  });

  it("fails when line currencies differ", () => {
    expect(
      issueCodes({
        ...balancedEntry,
        lines: [
          balancedEntry.lines[0]!,
          { ...balancedEntry.lines[1]!, currency: "USD" }
        ]
      })
    ).toContain("journal.currency_mismatch");
  });
});
