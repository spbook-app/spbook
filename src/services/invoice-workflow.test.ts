import { beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type SpbookDatabase } from "../storage/db";
import { initializeDefaultWorkspace } from "../storage/initialize-workspace";
import {
  createSalesInvoice,
  recordInvoicePayment
} from "./invoice-workflow";
import {
  recordOwnerContribution,
  recordOwnerWithdrawal
} from "./owner-transactions-workflow";
import {
  createSupplierInvoice,
  recordSupplierPayment
} from "./supplier-invoice-workflow";
import { loadWorkspaceOverview } from "./workspace-overview";

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

  it("creates and pays a supplier invoice", async () => {
    const initialization = await initializeDefaultWorkspace(database);
    const issuedOverview = await createSupplierInvoice(
      {
        workspaceId: initialization.workspace.id,
        supplierName: "Bank Services d.o.o.",
        number: "SUP-2026-0001",
        issueDate: "2026-05-10",
        total: "40.00",
        currency: "EUR"
      },
      database
    );
    const paidOverview = await recordSupplierPayment(
      issuedOverview.latestSupplierInvoice?.id ?? "",
      database
    );

    expect(issuedOverview.latestSupplierInvoice?.status).toBe("received");
    expect(balanceFor(issuedOverview.balances, "4100")).toBe("40.00");
    expect(balanceFor(issuedOverview.balances, "2200")).toBe("-40.00");
    expect(paidOverview.latestSupplierInvoice?.status).toBe("paid");
    expect(balanceFor(paidOverview.balances, "4100")).toBe("40.00");
    expect(balanceFor(paidOverview.balances, "2200")).toBe("0.00");
    expect(balanceFor(paidOverview.balances, "1100")).toBe("-40.00");
  });

  it("records owner contribution and withdrawal", async () => {
    const initialization = await initializeDefaultWorkspace(database);
    const contributionOverview = await recordOwnerContribution(
      {
        workspaceId: initialization.workspace.id,
        entryDate: "2026-05-10",
        amount: "300.00",
        currency: "EUR"
      },
      database
    );
    const withdrawalOverview = await recordOwnerWithdrawal(
      {
        workspaceId: initialization.workspace.id,
        entryDate: "2026-05-11",
        amount: "75.00",
        currency: "EUR"
      },
      database
    );

    expect(contributionOverview.journalEntries).toHaveLength(1);
    expect(balanceFor(contributionOverview.balances, "1100")).toBe("300.00");
    expect(balanceFor(contributionOverview.balances, "2850")).toBe("-300.00");
    expect(withdrawalOverview.journalEntries).toHaveLength(2);
    expect(balanceFor(withdrawalOverview.balances, "1100")).toBe("225.00");
    expect(balanceFor(withdrawalOverview.balances, "2850")).toBe("-225.00");
  });
});

function balanceFor(
  balances: Array<{ accountCode: string; amount: string }>,
  accountCode: string
) {
  return balances.find((balance) => balance.accountCode === accountCode)?.amount;
}
