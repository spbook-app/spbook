import { describe, expect, it, vi } from "vitest";
import type { Workspace } from "../domain";
import type { Repositories } from "../storage/interfaces";
import {
  loadBankingSlice,
  loadInvoicesSlice,
  loadLedgerSlice,
  loadWorkspaceOverview,
} from "./workspace-overview";

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

/**
 * Creates a {@link Repositories} mock where every method returns empty results
 * by default. Pass a full repository object (not a partial method set) in
 * overrides to replace a specific repository — spread works at the top level
 * only, not deep-merging individual methods.
 */
function makeMockRepos(overrides: Partial<Repositories> = {}): Repositories {
  return {
    workspace: { count: vi.fn(), getFirst: vi.fn() },
    accounts: {
      getById: vi.fn(),
      getByWorkspaceId: vi.fn().mockResolvedValue([]),
      save: vi.fn(),
    },
    parties: {
      getById: vi.fn(),
      getByWorkspaceId: vi.fn().mockResolvedValue([]),
      save: vi.fn(),
    },
    bankAccounts: {
      getById: vi.fn(),
      getByWorkspaceId: vi.fn().mockResolvedValue([]),
      save: vi.fn(),
    },
    bankTransactions: {
      getById: vi.fn(),
      getByWorkspaceId: vi.fn().mockResolvedValue([]),
      save: vi.fn(),
      saveAll: vi.fn(),
    },
    invoices: {
      getById: vi.fn(),
      getByWorkspaceId: vi.fn().mockResolvedValue([]),
      save: vi.fn(),
    },
    supplierInvoices: {
      getById: vi.fn(),
      getByWorkspaceId: vi.fn().mockResolvedValue([]),
      save: vi.fn(),
    },
    journalEntries: {
      getById: vi.fn(),
      getByWorkspaceId: vi.fn().mockResolvedValue([]),
      save: vi.fn(),
    },
    ...overrides,
  };
}

const mockWorkspace: Workspace = {
  id: "ws-1",
  name: "Test Workspace",
  countryCode: "SI",
  baseCurrency: "EUR",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

// ---------------------------------------------------------------------------
// loadWorkspaceOverview
// ---------------------------------------------------------------------------

describe("loadWorkspaceOverview", () => {
  it("returns a fully assembled WorkspaceOverview from repositories", async () => {
    const repos = makeMockRepos({
      workspace: {
        count: vi.fn().mockResolvedValue(1),
        getFirst: vi.fn().mockResolvedValue(mockWorkspace),
      },
    });

    const result = await loadWorkspaceOverview("ws-1", repos);

    expect(result.workspace).toEqual(mockWorkspace);
    expect(result.accounts).toEqual([]);
    expect(result.parties).toEqual([]);
    expect(result.invoices).toEqual([]);
    expect(result.latestInvoice).toBeNull();
    expect(result.supplierInvoices).toEqual([]);
    expect(result.latestSupplierInvoice).toBeNull();
    expect(result.journalEntries).toEqual([]);
    expect(result.balances).toEqual([]);
  });

  it("throws when workspace is not found", async () => {
    const repos = makeMockRepos({
      workspace: {
        count: vi.fn().mockResolvedValue(0),
        getFirst: vi.fn().mockResolvedValue(undefined),
      },
    });

    await expect(loadWorkspaceOverview("ws-1", repos)).rejects.toThrow("ws-1");
  });

  it("throws when workspace id does not match", async () => {
    const repos = makeMockRepos({
      workspace: {
        count: vi.fn(),
        getFirst: vi.fn().mockResolvedValue({ ...mockWorkspace, id: "ws-other" }),
      },
    });

    await expect(loadWorkspaceOverview("ws-1", repos)).rejects.toThrow("ws-1");
  });

  it("resolves latestInvoiceParty from the parties list", async () => {
    const party = { id: "party-1", name: "ACME", workspaceId: "ws-1" };
    const invoice = { id: "inv-1", partyId: "party-1", workspaceId: "ws-1" };

    const repos = makeMockRepos({
      workspace: {
        count: vi.fn(),
        getFirst: vi.fn().mockResolvedValue(mockWorkspace),
      },
      invoices: {
        getById: vi.fn(),
        getByWorkspaceId: vi.fn().mockResolvedValue([invoice]),
        save: vi.fn(),
      },
      parties: {
        getById: vi.fn(),
        getByWorkspaceId: vi.fn().mockResolvedValue([party]),
        save: vi.fn(),
      },
    });

    const result = await loadWorkspaceOverview("ws-1", repos);

    expect(result.latestInvoice).toEqual(invoice);
    expect(result.latestInvoiceParty).toEqual(party);
  });
});

// ---------------------------------------------------------------------------
// loadInvoicesSlice
// ---------------------------------------------------------------------------

describe("loadInvoicesSlice", () => {
  it("returns invoice: null when there are no invoices", async () => {
    const result = await loadInvoicesSlice("ws-1", undefined, makeMockRepos());

    expect(result.invoice).toBeNull();
    expect(result.invoices).toEqual([]);
    expect(result.invoiceParty).toBeNull();
  });

  it("falls back to the last invoice in the list", async () => {
    const invoiceA = { id: "inv-1", partyId: "p-1", workspaceId: "ws-1" };
    const invoiceB = { id: "inv-2", partyId: "p-1", workspaceId: "ws-1" };
    const party = { id: "p-1", name: "ACME", workspaceId: "ws-1" };

    const repos = makeMockRepos({
      invoices: {
        getById: vi.fn(),
        getByWorkspaceId: vi.fn().mockResolvedValue([invoiceA, invoiceB]),
        save: vi.fn(),
      },
      parties: {
        getById: vi.fn(),
        getByWorkspaceId: vi.fn().mockResolvedValue([party]),
        save: vi.fn(),
      },
    });

    const result = await loadInvoicesSlice("ws-1", undefined, repos);

    expect(result.invoice).toEqual(invoiceB);
    expect(result.invoiceParty).toEqual(party);
  });

  it("uses selectedInvoice when provided", async () => {
    const invoiceA = { id: "inv-1", partyId: "p-1", workspaceId: "ws-1" };
    const invoiceB = { id: "inv-2", partyId: "p-1", workspaceId: "ws-1" };

    const repos = makeMockRepos({
      invoices: {
        getById: vi.fn(),
        getByWorkspaceId: vi.fn().mockResolvedValue([invoiceA, invoiceB]),
        save: vi.fn(),
      },
    });

    const result = await loadInvoicesSlice("ws-1", invoiceA as never, repos);

    expect(result.invoice).toEqual(invoiceA);
  });
});

// ---------------------------------------------------------------------------
// loadLedgerSlice
// ---------------------------------------------------------------------------

describe("loadLedgerSlice", () => {
  it("returns empty journal entries and balances when there are none", async () => {
    const result = await loadLedgerSlice("ws-1", makeMockRepos());

    expect(result.journalEntries).toEqual([]);
    expect(result.balances).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// loadBankingSlice
// ---------------------------------------------------------------------------

describe("loadBankingSlice", () => {
  it("returns empty bankAccounts and bankTransactions", async () => {
    const result = await loadBankingSlice("ws-1", makeMockRepos());

    expect(result.bankAccounts).toEqual([]);
    expect(result.bankTransactions).toEqual([]);
  });
});
