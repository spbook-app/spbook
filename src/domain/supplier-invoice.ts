import type { Party, SupplierInvoice } from "./entities";
import { parseMoneyAmount } from "./money";
import { getPartyById, partyHasRole } from "./parties";
import { invalid, valid, type ValidationIssue, type ValidationResult } from "./validation";

export function validateSupplierInvoice(
  supplierInvoice: SupplierInvoice,
  parties: Party[]
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const supplier = getPartyById(parties, supplierInvoice.supplierId);

  if (!supplier) {
    issues.push({
      code: "supplier_invoice.supplier_missing",
      message: `Supplier "${supplierInvoice.supplierId}" does not exist.`,
      path: "supplierId"
    });
  } else if (!partyHasRole(supplier, "supplier")) {
    issues.push({
      code: "supplier_invoice.party_not_supplier",
      message: `Party "${supplierInvoice.supplierId}" must have the supplier role.`,
      path: "supplierId"
    });
  }

  if (!supplierInvoice.currency) {
    issues.push({
      code: "supplier_invoice.currency_missing",
      message: "Supplier invoice currency is required.",
      path: "currency"
    });
  }

  if (!supplierInvoice.expenseAccountCode) {
    issues.push({
      code: "supplier_invoice.expense_account_missing",
      message: "Supplier invoice expense account is required.",
      path: "expenseAccountCode"
    });
  }

  const total = parseMoneyAmount(supplierInvoice.total);
  if (!total.ok) {
    issues.push({
      code: "supplier_invoice.total_invalid",
      message: `Supplier invoice total "${supplierInvoice.total}" is invalid.`,
      path: "total"
    });
  }

  return issues.length === 0 ? valid() : invalid(issues);
}
