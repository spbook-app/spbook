import type { Invoice, Party } from "./entities";
import { parseMoneyAmount } from "./money";
import { getPartyById, partyHasRole } from "./parties";
import { invalid, valid, type ValidationIssue, type ValidationResult } from "./validation";

export function validateInvoice(invoice: Invoice, parties: Party[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  const party = getPartyById(parties, invoice.partyId);

  if (!party) {
    issues.push({
      code: "invoice.party_missing",
      message: `Party "${invoice.partyId}" does not exist.`,
      path: "partyId"
    });
  } else if (!partyHasRole(party, "customer")) {
    issues.push({
      code: "invoice.party_not_customer",
      message: `Party "${invoice.partyId}" must have the customer role.`,
      path: "partyId"
    });
  }

  if (!invoice.currency) {
    issues.push({
      code: "invoice.currency_missing",
      message: "Invoice currency is required.",
      path: "currency"
    });
  }

  const total = parseMoneyAmount(invoice.total);
  if (!total.ok) {
    issues.push({
      code: "invoice.total_invalid",
      message: `Invoice total "${invoice.total}" is invalid.`,
      path: "total"
    });
  }

  return issues.length === 0 ? valid() : invalid(issues);
}
