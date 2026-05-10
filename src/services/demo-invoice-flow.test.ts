import { afterEach, describe, expect, it } from "vitest";
import { validateJournalEntry } from "../domain";
import { createDatabase, type SpbookDatabase } from "../storage/db";
import { initializeDefaultWorkspace } from "../storage/initialize-workspace";
import {
  getAccountsByWorkspaceId,
  getInvoicesByWorkspaceId,
  getJournalEntriesByWorkspaceId,
  getPartiesByWorkspaceId
} from "../storage/repositories";
import {
  DEMO_CUSTOMER_PARTY_ID,
  DEMO_INVOICE_ID,
  runDemoInvoicePaymentFlow
} from "./demo-invoice-flow";

let database: SpbookDatabase | null = null;

function testDatabase() {
  database = createDatabase(`spbook_test_${crypto.randomUUID()}`);
  return database;
}

afterEach(async () => {
  if (database) {
    await database.delete();
    database = null;
  }
});

describe("runDemoInvoicePaymentFlow", () => {
  it("creates party, paid invoice, journal entries, and balances", async () => {
    const db = testDatabase();
    const { workspace } = await initializeDefaultWorkspace(db);
    const result = await runDemoInvoicePaymentFlow(workspace.id, db);

    expect(result.party.id).toBe(DEMO_CUSTOMER_PARTY_ID);
    expect(result.invoice.id).toBe(DEMO_INVOICE_ID);
    expect(result.invoice.status).toBe("paid");
    expect(result.journalEntries).toHaveLength(2);
    expect(result.balances.map((balance) => [balance.accountCode, balance.amount])).toEqual([
      ["1100", "1000.00"],
      ["1200", "0.00"],
      ["7600", "-1000.00"]
    ]);
  });

  it("is idempotent", async () => {
    const db = testDatabase();
    const { workspace } = await initializeDefaultWorkspace(db);

    await runDemoInvoicePaymentFlow(workspace.id, db);
    await runDemoInvoicePaymentFlow(workspace.id, db);

    expect(await getPartiesByWorkspaceId(workspace.id, db)).toHaveLength(1);
    expect(await getInvoicesByWorkspaceId(workspace.id, db)).toHaveLength(1);
    expect(await getJournalEntriesByWorkspaceId(workspace.id, db)).toHaveLength(2);
  });

  it("creates journal entries that pass domain validation", async () => {
    const db = testDatabase();
    const { workspace } = await initializeDefaultWorkspace(db);
    await runDemoInvoicePaymentFlow(workspace.id, db);

    const accounts = await getAccountsByWorkspaceId(workspace.id, db);
    const entries = await getJournalEntriesByWorkspaceId(workspace.id, db);

    expect(entries.map((entry) => validateJournalEntry(entry, accounts))).toEqual([
      { ok: true },
      { ok: true }
    ]);
  });
});
