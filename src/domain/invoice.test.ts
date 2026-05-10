import { describe, expect, it } from "vitest";
import type { Invoice, Party } from "./entities";
import { validateInvoice } from "./invoice";

const parties: Party[] = [
  {
    id: "party_customer",
    workspaceId: "ws_demo",
    name: "Customer d.o.o.",
    type: "business",
    roles: ["customer"],
    active: true
  },
  {
    id: "party_supplier",
    workspaceId: "ws_demo",
    name: "Supplier d.o.o.",
    type: "business",
    roles: ["supplier"],
    active: true
  }
];

const invoice: Invoice = {
  id: "inv_2026_0001",
  workspaceId: "ws_demo",
  number: "2026-0001",
  issueDate: "2026-04-01",
  partyId: "party_customer",
  currency: "EUR",
  total: "1000.00",
  status: "issued"
};

function issueCodes(value: Invoice) {
  const result = validateInvoice(value, parties);
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe("validateInvoice", () => {
  it("passes an invoice with a customer party", () => {
    expect(validateInvoice(invoice, parties)).toEqual({ ok: true });
  });

  it("fails an invoice with a supplier-only party", () => {
    expect(issueCodes({ ...invoice, partyId: "party_supplier" })).toContain(
      "invoice.party_not_customer"
    );
  });

  it("fails an invoice with a missing party", () => {
    expect(issueCodes({ ...invoice, partyId: "party_missing" })).toContain(
      "invoice.party_missing"
    );
  });

  it("fails an invoice with an invalid total", () => {
    expect(issueCodes({ ...invoice, total: "0.00" })).toContain(
      "invoice.total_invalid"
    );
  });

  it("fails an invoice without currency", () => {
    expect(issueCodes({ ...invoice, currency: "" })).toContain(
      "invoice.currency_missing"
    );
  });
});
