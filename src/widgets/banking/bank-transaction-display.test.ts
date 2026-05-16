import { describe, expect, it } from "vitest";
import type { BankTransaction } from "../../domain";
import { getBankTransactionDisplayState } from "./bank-transaction-display";

const base: BankTransaction = {
  id: "tx1",
  workspaceId: "ws1",
  bankAccountId: "ba1",
  bookingDate: "2026-05-01",
  amount: "1000.00",
  currency: "EUR",
  description: "Payment",
  status: "unmatched",
  importSource: "camt053"
};

describe("getBankTransactionDisplayState", () => {
  it("ignored → ignored / neutral", () => {
    const state = getBankTransactionDisplayState(
      { ...base, status: "ignored" },
      undefined,
      false,
      false
    );
    expect(state.processingState).toBe("ignored");
    expect(state.tone).toBe("neutral");
  });

  it("matched invoice → matched_sales_invoice / success", () => {
    const state = getBankTransactionDisplayState(
      { ...base, status: "matched", matchedDocumentType: "invoice", matchedDocumentId: "inv1" },
      undefined,
      false,
      false
    );
    expect(state.processingState).toBe("matched_sales_invoice");
    expect(state.tone).toBe("success");
  });

  it("matched supplier invoice → matched_supplier_invoice / success", () => {
    const state = getBankTransactionDisplayState(
      {
        ...base,
        status: "matched",
        matchedDocumentType: "supplier_invoice",
        matchedDocumentId: "si1"
      },
      undefined,
      false,
      false
    );
    expect(state.processingState).toBe("matched_supplier_invoice");
    expect(state.tone).toBe("success");
  });

  it("posted bank fee → posted_bank_fee / info", () => {
    const state = getBankTransactionDisplayState(
      { ...base, status: "posted", matchedDocumentType: "bank_fee" },
      undefined,
      false,
      false
    );
    expect(state.processingState).toBe("posted_bank_fee");
    expect(state.tone).toBe("info");
  });

  it("unmatched, no partyId, no importSource → manual_unmatched / neutral", () => {
    const state = getBankTransactionDisplayState(
      { ...base, status: "unmatched", importSource: undefined },
      undefined,
      false,
      false
    );
    expect(state.processingState).toBe("manual_unmatched");
    expect(state.tone).toBe("neutral");
    expect(state.isImported).toBe(false);
  });

  it("unmatched, no partyId, imported → needs_counterparty / warning", () => {
    const state = getBankTransactionDisplayState(
      { ...base, status: "unmatched", importSource: "camt053" },
      undefined,
      false,
      false
    );
    expect(state.processingState).toBe("needs_counterparty");
    expect(state.tone).toBe("warning");
    expect(state.isImported).toBe(true);
  });

  it("unmatched, partyId, incoming, invoice candidate → invoice_candidate / info", () => {
    const state = getBankTransactionDisplayState(
      { ...base, status: "unmatched", partyId: "p1", amount: "1000.00" },
      { id: "p1", workspaceId: "ws1", name: "ACME", type: "business", roles: ["customer"], active: true },
      true,
      false
    );
    expect(state.processingState).toBe("invoice_candidate");
    expect(state.tone).toBe("info");
  });

  it("unmatched, partyId, outgoing, supplier invoice candidate → supplier_invoice_candidate / info", () => {
    const state = getBankTransactionDisplayState(
      { ...base, status: "unmatched", partyId: "p1", amount: "-500.00" },
      { id: "p1", workspaceId: "ws1", name: "Supplier", type: "business", roles: ["supplier"], active: true },
      false,
      true
    );
    expect(state.processingState).toBe("supplier_invoice_candidate");
    expect(state.tone).toBe("info");
  });

  it("unmatched, partyId, no candidate → linked_needs_match / warning", () => {
    const state = getBankTransactionDisplayState(
      { ...base, status: "unmatched", partyId: "p1" },
      { id: "p1", workspaceId: "ws1", name: "ACME", type: "business", roles: ["customer"], active: true },
      false,
      false
    );
    expect(state.processingState).toBe("linked_needs_match");
    expect(state.tone).toBe("warning");
  });

  it("isImported reflects importSource presence", () => {
    const withImport = getBankTransactionDisplayState(
      { ...base, importSource: "camt053" },
      undefined,
      false,
      false
    );
    const withoutImport = getBankTransactionDisplayState(
      { ...base, importSource: undefined },
      undefined,
      false,
      false
    );
    expect(withImport.isImported).toBe(true);
    expect(withoutImport.isImported).toBe(false);
  });
});
