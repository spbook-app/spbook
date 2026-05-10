import { beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type SpbookDatabase } from "../storage/db";
import { initializeDefaultWorkspace } from "../storage/initialize-workspace";
import {
  createSalesInvoice,
  loadWorkspaceOverview,
  recordInvoicePayment
} from "./invoice-workflow";

describe("invoice workflow", () => {
  let database: SpbookDatabase;

  beforeEach(() => {
    database = createDatabase(`spbook_invoice_workflow_test_${crypto.randomUUID()}`);
  });

  it("creates an issued invoice with a balanced journal entry", async () => {
    const initialization = await initializeDefaultWorkspace(database);
    const overview = await createSalesInvoice(
      {
        workspaceId: initialization.workspace.id,
        customerName: "ACME d.o.o.",
        number: "2026-0002",
        issueDate: "2026-05-10",
        total: "250.00",
        currency: "EUR"
      },
      database
    );

    expect(overview.parties).toHaveLength(1);
    expect(overview.latestInvoice?.status).toBe("issued");
    expect(overview.latestInvoice?.total).toBe("250.00");
    expect(overview.journalEntries).toHaveLength(1);
    expect(balanceFor(overview.balances, "1200")).toBe("250.00");
    expect(balanceFor(overview.balances, "7600")).toBe("-250.00");
  });

  it("records payment and marks invoice as paid without duplicating payment", async () => {
    const initialization = await initializeDefaultWorkspace(database);
    const issuedOverview = await createSalesInvoice(
      {
        workspaceId: initialization.workspace.id,
        customerName: "ACME d.o.o.",
        number: "2026-0003",
        issueDate: "2026-05-10",
        total: "1000.00",
        currency: "EUR"
      },
      database
    );
    const paidOverview = await recordInvoicePayment(
      issuedOverview.latestInvoice?.id ?? "",
      database
    );
    const secondPaymentOverview = await recordInvoicePayment(
      paidOverview.latestInvoice?.id ?? "",
      database
    );

    expect(paidOverview.latestInvoice?.status).toBe("paid");
    expect(secondPaymentOverview.journalEntries).toHaveLength(2);
    expect(balanceFor(secondPaymentOverview.balances, "1100")).toBe("1000.00");
    expect(balanceFor(secondPaymentOverview.balances, "1200")).toBe("0.00");
    expect(balanceFor(secondPaymentOverview.balances, "7600")).toBe("-1000.00");
  });

  it("loads an empty overview before an invoice is created", async () => {
    const initialization = await initializeDefaultWorkspace(database);
    const overview = await loadWorkspaceOverview(initialization.workspace.id, database);

    expect(overview.latestInvoice).toBeNull();
    expect(overview.journalEntries).toHaveLength(0);
    expect(overview.balances).toHaveLength(0);
  });

  it("rejects payment for a missing invoice", async () => {
    await expect(recordInvoicePayment("missing", database)).rejects.toThrow(
      'Invoice "missing" was not found.'
    );
  });
});

function balanceFor(
  balances: Array<{ accountCode: string; amount: string }>,
  accountCode: string
) {
  return balances.find((balance) => balance.accountCode === accountCode)?.amount;
}
