import { beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type SpbookDatabase } from "../storage/db";
import { createWorkflowStorage } from "../storage/workflow-persistence";
import { initializeDefaultWorkspace } from "../storage/initialize-workspace";
import { defaultCountryConfig } from "../app/country-config";
import {
  createSalesInvoice,
  deleteSalesInvoice,
  recordInvoicePayment,
  updateSalesInvoice
} from "./invoice-workflow";
import {
  recordOwnerContribution,
  recordOwnerWithdrawal
} from "./owner-transactions-workflow";
import { createParty } from "./party-workflow";
import {
  createSupplierInvoice,
  deleteSupplierInvoice,
  recordSupplierPayment,
  updateSupplierInvoice
} from "./supplier-invoice-workflow";
import { loadWorkspaceOverview } from "./workspace-overview";
import { createRepositories } from "../storage/repositories";

describe("invoice workflow", () => {
  let database: SpbookDatabase;

  beforeEach(() => {
    database = createDatabase(`spbook_invoice_workflow_test_${crypto.randomUUID()}`);
  });

  it("creates an issued invoice with a balanced journal entry", async () => {
    const initialization = await initializeDefaultWorkspace(defaultCountryConfig, database);
    const partyOverview = await createParty(
      {
        workspaceId: initialization.workspace.id,
        name: "ACME d.o.o.",
        type: "business",
        roles: ["customer"],
        countryCode: "SI",
        vatId: "SI12345678"
      },
      createWorkflowStorage(database)
    );
    const overview = await createSalesInvoice(
      {
        workspaceId: initialization.workspace.id,
        partyId: partyOverview.parties[0]!.id,
        number: "2026-0002",
        issueDate: "2026-05-10",
        total: "250.00",
        currency: "EUR"
      },
      database
    );

    expect(overview.invoiceParty?.id).toBe(partyOverview.parties[0]!.id);
    expect(overview.invoice?.status).toBe("issued");
    expect(overview.invoice?.total).toBe("250.00");
    expect(overview.journalEntries).toHaveLength(1);
    expect(balanceFor(overview.balances, "1200")).toBe("250.00");
    expect(balanceFor(overview.balances, "7600")).toBe("-250.00");
  });

  it("records payment and marks invoice as paid without duplicating payment", async () => {
    const initialization = await initializeDefaultWorkspace(defaultCountryConfig, database);
    const partyOverview = await createParty(
      {
        workspaceId: initialization.workspace.id,
        name: "ACME d.o.o.",
        type: "business",
        roles: ["customer"]
      },
      createWorkflowStorage(database)
    );
    const issuedOverview = await createSalesInvoice(
      {
        workspaceId: initialization.workspace.id,
        partyId: partyOverview.parties[0]!.id,
        number: "2026-0003",
        issueDate: "2026-05-10",
        total: "1000.00",
        currency: "EUR"
      },
      database
    );
    const paidOverview = await recordInvoicePayment(
      issuedOverview.invoice?.id ?? "",
      database
    );
    const secondPaymentOverview = await recordInvoicePayment(
      paidOverview.invoice?.id ?? "",
      database
    );

    expect(paidOverview.invoice?.status).toBe("paid");
    expect(secondPaymentOverview.journalEntries).toHaveLength(2);
    expect(balanceFor(secondPaymentOverview.balances, "1100")).toBe("1000.00");
    expect(balanceFor(secondPaymentOverview.balances, "1200")).toBe("0.00");
    expect(balanceFor(secondPaymentOverview.balances, "7600")).toBe("-1000.00");
  });

  it("updates and deletes unpaid issued invoices", async () => {
    const initialization = await initializeDefaultWorkspace(defaultCountryConfig, database);
    const partyOverview = await createParty(
      {
        workspaceId: initialization.workspace.id,
        name: "ACME d.o.o.",
        type: "business",
        roles: ["customer"]
      },
      createWorkflowStorage(database)
    );
    const issuedOverview = await createSalesInvoice(
      {
        workspaceId: initialization.workspace.id,
        partyId: partyOverview.parties[0]!.id,
        number: "2026-0005",
        issueDate: "2026-05-10",
        total: "100.00",
        currency: "EUR"
      },
      database
    );
    const updatedOverview = await updateSalesInvoice(
      {
        invoiceId: issuedOverview.invoice!.id,
        partyId: partyOverview.parties[0]!.id,
        number: "2026-0005-UPDATED",
        issueDate: "2026-05-11",
        total: "150.00"
      },
      database
    );
    const deletedOverview = await deleteSalesInvoice(
      issuedOverview.invoice!.id,
      database
    );

    expect(updatedOverview.invoice).toMatchObject({
      number: "2026-0005-UPDATED",
      issueDate: "2026-05-11",
      total: "150.00"
    });
    expect(balanceFor(updatedOverview.balances, "1200")).toBe("150.00");
    expect(deletedOverview.invoices).toHaveLength(0);
    expect(deletedOverview.journalEntries).toHaveLength(0);
  });

  it("loads an empty overview before an invoice is created", async () => {
    const initialization = await initializeDefaultWorkspace(defaultCountryConfig, database);
    const overview = await loadWorkspaceOverview(initialization.workspace.id, createRepositories(database));

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
    const initialization = await initializeDefaultWorkspace(defaultCountryConfig, database);
    const partyOverview = await createParty(
      {
        workspaceId: initialization.workspace.id,
        name: "Bank Services d.o.o.",
        type: "business",
        roles: ["supplier"]
      },
      createWorkflowStorage(database)
    );
    const issuedOverview = await createSupplierInvoice(
      {
        workspaceId: initialization.workspace.id,
        partyId: partyOverview.parties[0]!.id,
        number: "SUP-2026-0001",
        issueDate: "2026-05-10",
        total: "40.00",
        currency: "EUR"
      },
      database
    );
    const paidOverview = await recordSupplierPayment(
      issuedOverview.supplierInvoice?.id ?? "",
      database
    );

    expect(issuedOverview.supplierInvoice?.status).toBe("received");
    expect(balanceFor(issuedOverview.balances, "4100")).toBe("40.00");
    expect(balanceFor(issuedOverview.balances, "2200")).toBe("-40.00");
    expect(paidOverview.supplierInvoice?.status).toBe("paid");
    expect(balanceFor(paidOverview.balances, "4100")).toBe("40.00");
    expect(balanceFor(paidOverview.balances, "2200")).toBe("0.00");
    expect(balanceFor(paidOverview.balances, "1100")).toBe("-40.00");
  });

  it("updates and deletes unpaid supplier invoices", async () => {
    const initialization = await initializeDefaultWorkspace(defaultCountryConfig, database);
    const partyOverview = await createParty(
      {
        workspaceId: initialization.workspace.id,
        name: "Bank Services d.o.o.",
        type: "business",
        roles: ["supplier"]
      },
      createWorkflowStorage(database)
    );
    const issuedOverview = await createSupplierInvoice(
      {
        workspaceId: initialization.workspace.id,
        partyId: partyOverview.parties[0]!.id,
        number: "SUP-2026-0003",
        issueDate: "2026-05-10",
        total: "40.00",
        currency: "EUR"
      },
      database
    );
    const updatedOverview = await updateSupplierInvoice(
      {
        supplierInvoiceId: issuedOverview.supplierInvoice!.id,
        partyId: partyOverview.parties[0]!.id,
        number: "SUP-2026-0003-UPDATED",
        issueDate: "2026-05-11",
        total: "50.00",
        expenseAccountCode: "4120"
      },
      database
    );
    const deletedOverview = await deleteSupplierInvoice(
      issuedOverview.supplierInvoice!.id,
      database
    );

    expect(updatedOverview.supplierInvoice).toMatchObject({
      number: "SUP-2026-0003-UPDATED",
      issueDate: "2026-05-11",
      total: "50.00",
      expenseAccountCode: "4120"
    });
    expect(balanceFor(updatedOverview.balances, "4120")).toBe("50.00");
    expect(deletedOverview.supplierInvoices).toHaveLength(0);
    expect(deletedOverview.journalEntries).toHaveLength(0);
  });

  it("records owner contribution and withdrawal", async () => {
    const initialization = await initializeDefaultWorkspace(defaultCountryConfig, database);
    const contributionOverview = await recordOwnerContribution(
      {
        workspaceId: initialization.workspace.id,
        entryDate: "2026-05-10",
        amount: "300.00",
        currency: "EUR"
      },
      createWorkflowStorage(database)
    );
    const withdrawalOverview = await recordOwnerWithdrawal(
      {
        workspaceId: initialization.workspace.id,
        entryDate: "2026-05-11",
        amount: "75.00",
        currency: "EUR"
      },
      createWorkflowStorage(database)
    );

    expect(contributionOverview.journalEntries).toHaveLength(1);
    expect(balanceFor(contributionOverview.balances, "1100")).toBe("300.00");
    expect(balanceFor(contributionOverview.balances, "2850")).toBe("-300.00");
    expect(withdrawalOverview.journalEntries).toHaveLength(2);
    expect(balanceFor(withdrawalOverview.balances, "1100")).toBe("225.00");
    expect(balanceFor(withdrawalOverview.balances, "2850")).toBe("-225.00");
  });

  it("rejects invoice workflows with unsuitable party roles", async () => {
    const initialization = await initializeDefaultWorkspace(defaultCountryConfig, database);
    const supplierOverview = await createParty(
      {
        workspaceId: initialization.workspace.id,
        name: "Supplier d.o.o.",
        type: "business",
        roles: ["supplier"]
      },
      createWorkflowStorage(database)
    );
    const customerOverview = await createParty(
      {
        workspaceId: initialization.workspace.id,
        name: "Customer d.o.o.",
        type: "business",
        roles: ["customer"]
      },
      createWorkflowStorage(database)
    );

    await expect(
      createSalesInvoice(
        {
          workspaceId: initialization.workspace.id,
          partyId: supplierOverview.parties[0]!.id,
          number: "2026-0004",
          issueDate: "2026-05-10",
          total: "100.00",
          currency: "EUR"
        },
        database
      )
    ).rejects.toThrow("Invoice data is invalid.");

    await expect(
      createSupplierInvoice(
        {
          workspaceId: initialization.workspace.id,
          partyId: customerOverview.parties[0]!.id,
          number: "SUP-2026-0002",
          issueDate: "2026-05-10",
          total: "100.00",
          currency: "EUR"
        },
        database
      )
    ).rejects.toThrow("Supplier invoice data is invalid.");
  });
});

function balanceFor(
  balances: Array<{ accountCode: string; amount: string }>,
  accountCode: string
) {
  return balances.find((balance) => balance.accountCode === accountCode)?.amount;
}
