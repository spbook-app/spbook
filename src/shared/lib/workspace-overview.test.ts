import { describe, expect, it } from "vitest";
import type { ReadyWorkspaceData } from "../model/workspace";
import { applyWorkspaceUpdate } from "./workspace-overview";

function createReadyWorkspaceData(): ReadyWorkspaceData {
  return {
    workspace: {
      id: "ws1",
      name: "Test workspace",
      countryCode: "SI",
      baseCurrency: "EUR",
      createdAt: "2026-05-10T00:00:00.000Z",
      updatedAt: "2026-05-10T00:00:00.000Z"
    },
    accounts: [
      {
        id: "acc1",
        workspaceId: "ws1",
        code: "1100",
        name: "Bank account",
        role: "posting",
        currency: "EUR",
        active: true
      }
    ],
    bankAccounts: [
      {
        id: "ba1",
        workspaceId: "ws1",
        name: "NLB",
        accountCode: "1100",
        currency: "EUR",
        active: true
      }
    ],
    bankTransactions: [
      {
        id: "bt1",
        workspaceId: "ws1",
        bankAccountId: "ba1",
        bookingDate: "2026-05-10",
        valueDate: "2026-05-10",
        amount: "100.00",
        currency: "EUR",
        description: "Payment",
        status: "unmatched"
      }
    ],
    parties: [
      {
        id: "p1",
        workspaceId: "ws1",
        name: "Customer",
        type: "business",
        roles: ["customer"],
        active: true
      }
    ],
    invoices: [
      {
        id: "inv1",
        workspaceId: "ws1",
        partyId: "p1",
        number: "2026-0001",
        issueDate: "2026-05-10",
        total: "100.00",
        currency: "EUR",
        status: "issued"
      }
    ],
    invoice: null,
    invoiceParty: null,
    supplierInvoices: [],
    supplierInvoice: null,
    supplierInvoiceParty: null,
    journalEntries: [],
    balances: [],
    initializedWorkspace: true
  };
}

describe("applyWorkspaceUpdate", () => {
  it("preserves unrelated workspace slices when one slice changes", () => {
    const data = createReadyWorkspaceData();
    const updated = applyWorkspaceUpdate(data, {
      invoices: [{ ...data.invoices[0]!, status: "paid" }]
    });

    expect(updated.state).toBe("ready");

    if (updated.state !== "ready") return;

    expect(updated.invoices[0]?.status).toBe("paid");
    expect(updated.supplierInvoices).toBe(data.supplierInvoices);
    expect(updated.bankTransactions).toBe(data.bankTransactions);
    expect(updated.accounts).toBe(data.accounts);
    expect(updated.balances).toBe(data.balances);
    expect(updated.initializedWorkspace).toBe(true);
  });
});
