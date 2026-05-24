import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabase, type SpbookDatabase } from "../storage/db";
import { createWorkflowStorage, type WorkflowStorage } from "../storage/workflow-persistence";
import type { Account, Invoice } from "../domain";
import { initializeDefaultWorkspace } from "../storage/initialize-workspace";
import { defaultCountryConfig } from "../app/country-config";
import {
  createSalesInvoice,
  deleteSalesInvoice,
  issueSalesInvoice,
  recordInvoicePayment,
  unissueSalesInvoice,
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

  it("creates a draft invoice without a journal entry", async () => {
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
    const draftOverview = await createSalesInvoice(
      {
        workspaceId: initialization.workspace.id,
        partyId: partyOverview.parties[0]!.id,
        number: "2026-0002",
        issueDate: "2026-05-10",
        total: "250.00",
        currency: "EUR"
      },
      createWorkflowStorage(database)
    );

    expect(draftOverview.invoiceParty?.id).toBe(partyOverview.parties[0]!.id);
    expect(draftOverview.invoice?.status).toBe("draft");
    expect(draftOverview.invoice?.total).toBe("250.00");
    expect(draftOverview.journalEntries).toHaveLength(0);
    expect(draftOverview.balances).toHaveLength(0);
  });

  it("issues a draft invoice and creates a balanced journal entry", async () => {
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
    const draftOverview = await createSalesInvoice(
      {
        workspaceId: initialization.workspace.id,
        partyId: partyOverview.parties[0]!.id,
        number: "2026-0002",
        issueDate: "2026-05-10",
        total: "250.00",
        currency: "EUR"
      },
      createWorkflowStorage(database)
    );
    const issuedOverview = await issueSalesInvoice(
      draftOverview.invoice!.id,
      createWorkflowStorage(database)
    );

    expect(issuedOverview.invoice?.status).toBe("issued");
    expect(issuedOverview.journalEntries).toHaveLength(1);
    expect(balanceFor(issuedOverview.balances, "1200")).toBe("250.00");
    expect(balanceFor(issuedOverview.balances, "7600")).toBe("-250.00");
  });

  it("unissues an issued invoice and removes the journal entry", async () => {
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
    const draftOverview = await createSalesInvoice(
      {
        workspaceId: initialization.workspace.id,
        partyId: partyOverview.parties[0]!.id,
        number: "2026-0002",
        issueDate: "2026-05-10",
        total: "250.00",
        currency: "EUR"
      },
      createWorkflowStorage(database)
    );
    await issueSalesInvoice(draftOverview.invoice!.id, createWorkflowStorage(database));
    const unissuedOverview = await unissueSalesInvoice(
      draftOverview.invoice!.id,
      createWorkflowStorage(database)
    );

    expect(unissuedOverview.invoice?.status).toBe("draft");
    expect(unissuedOverview.journalEntries).toHaveLength(0);
    expect(unissuedOverview.balances).toHaveLength(0);
  });

  it("rejects unissueSalesInvoice from a paid invoice", async () => {
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
    const draftOverview = await createSalesInvoice(
      {
        workspaceId: initialization.workspace.id,
        partyId: partyOverview.parties[0]!.id,
        number: "2026-0002",
        issueDate: "2026-05-10",
        total: "250.00",
        currency: "EUR"
      },
      createWorkflowStorage(database)
    );
    await issueSalesInvoice(draftOverview.invoice!.id, createWorkflowStorage(database));
    await recordInvoicePayment(draftOverview.invoice!.id, createWorkflowStorage(database));

    await expect(
      unissueSalesInvoice(draftOverview.invoice!.id, createWorkflowStorage(database))
    ).rejects.toThrow("must be in issued status");
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
    const draftOverview = await createSalesInvoice(
      {
        workspaceId: initialization.workspace.id,
        partyId: partyOverview.parties[0]!.id,
        number: "2026-0003",
        issueDate: "2026-05-10",
        total: "1000.00",
        currency: "EUR"
      },
      createWorkflowStorage(database)
    );
    const issuedOverview = await issueSalesInvoice(
      draftOverview.invoice?.id ?? "",
      createWorkflowStorage(database)
    );
    const paidOverview = await recordInvoicePayment(
      issuedOverview.invoice?.id ?? "",
      createWorkflowStorage(database)
    );
    const secondPaymentOverview = await recordInvoicePayment(
      paidOverview.invoice?.id ?? "",
      createWorkflowStorage(database)
    );

    expect(paidOverview.invoice?.status).toBe("paid");
    expect(secondPaymentOverview.journalEntries).toHaveLength(2);
    expect(balanceFor(secondPaymentOverview.balances, "1100")).toBe("1000.00");
    expect(balanceFor(secondPaymentOverview.balances, "1200")).toBe("0.00");
    expect(balanceFor(secondPaymentOverview.balances, "7600")).toBe("-1000.00");
  });

  it("updates and deletes draft invoices", async () => {
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
    const draftOverview = await createSalesInvoice(
      {
        workspaceId: initialization.workspace.id,
        partyId: partyOverview.parties[0]!.id,
        number: "2026-0005",
        issueDate: "2026-05-10",
        total: "100.00",
        currency: "EUR"
      },
      createWorkflowStorage(database)
    );
    const updatedOverview = await updateSalesInvoice(
      {
        invoiceId: draftOverview.invoice!.id,
        partyId: partyOverview.parties[0]!.id,
        number: "2026-0005-UPDATED",
        issueDate: "2026-05-11",
        total: "150.00"
      },
      createWorkflowStorage(database)
    );
    const deletedOverview = await deleteSalesInvoice(
      draftOverview.invoice!.id,
      createWorkflowStorage(database)
    );

    expect(updatedOverview.invoice).toMatchObject({
      number: "2026-0005-UPDATED",
      issueDate: "2026-05-11",
      total: "150.00"
    });
    expect(deletedOverview.invoices).toHaveLength(0);
    expect(deletedOverview.journalEntries).toHaveLength(0);
  });

  it("rejects updateSalesInvoice from an issued invoice", async () => {
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
    const draftOverview = await createSalesInvoice(
      {
        workspaceId: initialization.workspace.id,
        partyId: partyOverview.parties[0]!.id,
        number: "2026-0005",
        issueDate: "2026-05-10",
        total: "100.00",
        currency: "EUR"
      },
      createWorkflowStorage(database)
    );
    await issueSalesInvoice(draftOverview.invoice!.id, createWorkflowStorage(database));

    await expect(
      updateSalesInvoice(
        {
          invoiceId: draftOverview.invoice!.id,
          partyId: partyOverview.parties[0]!.id,
          number: "2026-0005-UPDATED",
          issueDate: "2026-05-11",
          total: "150.00"
        },
        createWorkflowStorage(database)
      )
    ).rejects.toThrow("must be in draft status");
  });

  it("rejects deleteSalesInvoice from an issued invoice", async () => {
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
    const draftOverview = await createSalesInvoice(
      {
        workspaceId: initialization.workspace.id,
        partyId: partyOverview.parties[0]!.id,
        number: "2026-0005",
        issueDate: "2026-05-10",
        total: "100.00",
        currency: "EUR"
      },
      createWorkflowStorage(database)
    );
    await issueSalesInvoice(draftOverview.invoice!.id, createWorkflowStorage(database));

    await expect(
      deleteSalesInvoice(draftOverview.invoice!.id, createWorkflowStorage(database))
    ).rejects.toThrow("must be in draft status");
  });

  it("loads an empty overview before an invoice is created", async () => {
    const initialization = await initializeDefaultWorkspace(defaultCountryConfig, database);
    const overview = await loadWorkspaceOverview(initialization.workspace.id, createRepositories(database));

    expect(overview.latestInvoice).toBeNull();
    expect(overview.journalEntries).toHaveLength(0);
    expect(overview.balances).toHaveLength(0);
  });

  it("rejects payment for a missing invoice", async () => {
    await expect(recordInvoicePayment("missing", createWorkflowStorage(database))).rejects.toThrow(
      'Invoice "missing" was not found.'
    );
  });

  it("rejects recordInvoicePayment from a draft invoice", async () => {
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
    const draftOverview = await createSalesInvoice(
      {
        workspaceId: initialization.workspace.id,
        partyId: partyOverview.parties[0]!.id,
        number: "2026-0010",
        issueDate: "2026-05-10",
        total: "100.00",
        currency: "EUR"
      },
      createWorkflowStorage(database)
    );

    await expect(
      recordInvoicePayment(draftOverview.invoice!.id, createWorkflowStorage(database))
    ).rejects.toThrow("must be in issued status");

    const repos = createRepositories(database);
    const journalEntries = await repos.journalEntries.getByWorkspaceId(initialization.workspace.id);
    const invoice = await repos.invoices.getById(draftOverview.invoice!.id);
    expect(journalEntries).toHaveLength(0);
    expect(invoice?.status).toBe("draft");
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
      createWorkflowStorage(database)
    );
    const paidOverview = await recordSupplierPayment(
      issuedOverview.supplierInvoice?.id ?? "",
      createWorkflowStorage(database)
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
      createWorkflowStorage(database)
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
      createWorkflowStorage(database)
    );
    const deletedOverview = await deleteSupplierInvoice(
      issuedOverview.supplierInvoice!.id,
      createWorkflowStorage(database)
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
        createWorkflowStorage(database)
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
        createWorkflowStorage(database)
      )
    ).rejects.toThrow("Supplier invoice data is invalid.");
  });
});

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

function makeMockStorage(overrides: Partial<WorkflowStorage["repos"]> = {}): WorkflowStorage {
  const noop = vi.fn().mockResolvedValue(undefined);
  const emptyList = vi.fn().mockResolvedValue([]);
  return {
    repos: {
      workspace: { count: vi.fn(), getFirst: vi.fn() },
      accounts: { getById: vi.fn().mockResolvedValue(undefined), getByWorkspaceId: emptyList, save: noop },
      parties: { getById: vi.fn(), getByWorkspaceId: emptyList, save: noop },
      bankAccounts: { getById: vi.fn(), getByWorkspaceId: emptyList, save: noop },
      bankTransactions: { getById: vi.fn(), getByWorkspaceId: emptyList, save: noop, saveAll: noop },
      invoices: { getById: vi.fn(), getByWorkspaceId: emptyList, save: noop },
      supplierInvoices: { getById: vi.fn(), getByWorkspaceId: emptyList, save: noop },
      journalEntries: { getById: vi.fn(), getByWorkspaceId: emptyList, save: noop },
      ...overrides
    },
    persistence: {
      saveInvoiceWorkflowData: noop,
      saveInvoiceJournalEntryData: noop,
      deleteInvoiceWorkflowData: noop,
      revertInvoiceToDraft: noop,
      saveInvoicePaymentData: noop,
      saveSupplierInvoiceWorkflowData: noop,
      saveSupplierInvoiceJournalEntryData: noop,
      deleteSupplierInvoiceWorkflowData: noop,
      saveSupplierInvoicePaymentData: noop,
      saveBankTransactionPostingData: noop,
      undoBankTransactionPostingData: noop,
      savePartyJournalEntryData: noop
    }
  };
}

describe("invoice workflow (mock storage)", () => {
  it("records invoice payment via persistence without Dexie", async () => {
    const invoice: Invoice = {
      id: "inv-1",
      workspaceId: "ws-1",
      number: "2026-0001",
      issueDate: "2026-05-10",
      partyId: "party-1",
      currency: "EUR",
      total: "1000.00",
      status: "issued"
    };
    const accounts: Account[] = [
      { id: "acc-1100", workspaceId: "ws-1", code: "1100", name: "Bank Account", role: "posting", currency: "EUR", active: true },
      { id: "acc-1200", workspaceId: "ws-1", code: "1200", name: "Accounts Receivable", role: "posting", currency: "EUR", active: true }
    ];
    const saveInvoicePaymentData = vi.fn().mockResolvedValue(undefined);
    const storage = makeMockStorage({
      invoices: {
        getById: vi.fn().mockResolvedValue(invoice),
        getByWorkspaceId: vi.fn().mockResolvedValue([invoice]),
        save: vi.fn()
      },
      accounts: {
        getById: vi.fn(),
        getByWorkspaceId: vi.fn().mockResolvedValue(accounts),
        save: vi.fn()
      }
    });
    storage.persistence.saveInvoicePaymentData = saveInvoicePaymentData;

    const result = await recordInvoicePayment("inv-1", storage);

    expect(saveInvoicePaymentData).toHaveBeenCalledOnce();
    expect(saveInvoicePaymentData).toHaveBeenCalledWith(
      expect.objectContaining({
        invoice: expect.objectContaining({ status: "paid" }),
        journalEntry: expect.objectContaining({
          lines: [
            expect.objectContaining({ accountCode: "1100", side: "debit" }),
            expect.objectContaining({ accountCode: "1200", side: "credit" })
          ]
        })
      })
    );
    expect(result.invoice?.status).toBe("paid");
  });
});

function balanceFor(
  balances: Array<{ accountCode: string; amount: string }>,
  accountCode: string
) {
  return balances.find((balance) => balance.accountCode === accountCode)?.amount;
}
