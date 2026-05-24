import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabase, type SpbookDatabase } from "../storage/db";
import { initializeDefaultWorkspace } from "../storage/initialize-workspace";
import { defaultCountryConfig } from "../app/country-config";
import { createWorkflowStorage, type WorkflowStorage } from "../storage/workflow-persistence";
import type { Account } from "../domain";
import { createWorkspaceAccount, updateWorkspaceAccount } from "./account-workflow";

describe("account workflow", () => {
  let database: SpbookDatabase;

  beforeEach(() => {
    database = createDatabase(`spbook_account_workflow_test_${crypto.randomUUID()}`);
  });

  it("creates a posting account manually", async () => {
    const initialization = await initializeDefaultWorkspace(defaultCountryConfig, database);
    const overview = await createWorkspaceAccount(
      {
        workspaceId: initialization.workspace.id,
        code: "1101",
        name: "Second bank account",
        role: "posting",
        parentCode: "11",
        currency: "EUR"
      },
      createWorkflowStorage(database)
    );

    expect(overview.accounts.map((account) => account.code)).toContain("1101");
    expect(overview.accounts.find((account) => account.code === "1101")).toMatchObject({
      name: "Second bank account",
      parentCode: "11",
      role: "posting",
      currency: "EUR",
      active: true
    });
  });

  it("updates editable account fields", async () => {
    const initialization = await initializeDefaultWorkspace(defaultCountryConfig, database);
    const targetAccount = initialization.accounts.find((account) => account.code === "1100")!;
    const overview = await updateWorkspaceAccount(
      {
        accountId: targetAccount.id,
        name: "Main operating bank account",
        parentCode: "11",
        currency: "EUR",
        active: false
      },
      createWorkflowStorage(database)
    );

    expect(overview.accounts.find((account) => account.code === "1100")).toMatchObject({
      code: "1100",
      name: "Main operating bank account",
      active: false
    });
  });

  it("rejects duplicate account codes", async () => {
    const initialization = await initializeDefaultWorkspace(defaultCountryConfig, database);

    await expect(
      createWorkspaceAccount(
        {
          workspaceId: initialization.workspace.id,
          code: "1100",
          name: "Duplicate bank account",
          role: "posting",
          parentCode: "11",
          currency: "EUR"
        },
        createWorkflowStorage(database)
      )
    ).rejects.toThrow('Account code "1100" is already used.');
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
      accounts: {
        getById: vi.fn().mockResolvedValue(undefined),
        getByWorkspaceId: emptyList,
        save: noop
      },
      parties: {
        getById: vi.fn(),
        getByWorkspaceId: emptyList,
        save: noop
      },
      bankAccounts: {
        getById: vi.fn(),
        getByWorkspaceId: emptyList,
        save: noop
      },
      bankTransactions: {
        getById: vi.fn(),
        getByWorkspaceId: emptyList,
        save: noop,
        saveAll: noop
      },
      invoices: {
        getById: vi.fn(),
        getByWorkspaceId: emptyList,
        save: noop
      },
      supplierInvoices: {
        getById: vi.fn(),
        getByWorkspaceId: emptyList,
        save: noop
      },
      journalEntries: {
        getById: vi.fn(),
        getByWorkspaceId: emptyList,
        save: noop
      },
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

describe("account workflow (mock storage)", () => {
  it("creates an account and returns the accounts slice", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const parentGroup: Account = { id: "acc-11", workspaceId: "ws-1", code: "11", name: "Current Assets", role: "group", active: true };
    const storage = makeMockStorage({ accounts: { getById: vi.fn(), getByWorkspaceId: vi.fn().mockResolvedValue([parentGroup]), save } });

    const result = await createWorkspaceAccount(
      { workspaceId: "ws-1", code: "1101", name: "Test Account", role: "posting", parentCode: "11", currency: "EUR" },
      storage
    );

    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ code: "1101", workspaceId: "ws-1" }));
    expect(result).toHaveProperty("accounts");
  });

  it("rejects duplicate account codes without Dexie", async () => {
    const existing: Account = {
      id: "acc-existing",
      workspaceId: "ws-1",
      code: "1101",
      name: "Existing",
      role: "posting",
      active: true
    };
    const storage = makeMockStorage({
      accounts: { getById: vi.fn(), getByWorkspaceId: vi.fn().mockResolvedValue([existing]), save: vi.fn() }
    });

    await expect(
      createWorkspaceAccount(
        { workspaceId: "ws-1", code: "1101", name: "Duplicate", role: "posting" },
        storage
      )
    ).rejects.toThrow('Account code "1101" is already used.');
  });

  it("updates an existing account via save", async () => {
    const existing: Account = {
      id: "acc-1",
      workspaceId: "ws-1",
      code: "1100",
      name: "Old Name",
      role: "posting",
      parentCode: "11",
      currency: "EUR",
      active: true
    };
    const parentGroup: Account = { id: "acc-11", workspaceId: "ws-1", code: "11", name: "Current Assets", role: "group", active: true };
    const save = vi.fn().mockResolvedValue(undefined);
    const storage = makeMockStorage({
      accounts: { getById: vi.fn().mockResolvedValue(existing), getByWorkspaceId: vi.fn().mockResolvedValue([existing, parentGroup]), save }
    });

    await updateWorkspaceAccount(
      { accountId: "acc-1", name: "New Name", parentCode: "11", currency: "EUR", active: false },
      storage
    );

    expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: "acc-1", name: "New Name", active: false }));
  });

  it("throws when updating a non-existent account", async () => {
    const storage = makeMockStorage();

    await expect(
      updateWorkspaceAccount({ accountId: "non-existent", name: "X", active: true }, storage)
    ).rejects.toThrow('Account "non-existent" was not found.');
  });
});
