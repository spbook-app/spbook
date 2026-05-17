import { getAccountByCode } from "./accounts";
import type { Account, JournalEntry, JournalLineSide } from "./types";
import { addMinorUnits, compareMinorUnits, parseMoneyAmount } from "./money";
import { invalid, valid, type ValidationIssue, type ValidationResult } from "./validation";

export function validateJournalEntry(entry: JournalEntry, accounts: Account[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  const totals: Record<JournalLineSide, bigint[]> = {
    debit: [],
    credit: []
  };
  let currency: string | null = null;

  if (entry.lines.length < 2) {
    issues.push({
      code: "journal.too_few_lines",
      message: "A journal entry must contain at least two lines.",
      path: "lines"
    });
  }

  entry.lines.forEach((line, index) => {
    const path = `lines.${index}`;
    const account = getAccountByCode(accounts, line.accountCode);

    if (!account) {
      issues.push({
        code: "journal.account_missing",
        message: `Account "${line.accountCode}" does not exist.`,
        path: `${path}.accountCode`
      });
    } else if (account.role !== "posting") {
      issues.push({
        code: "journal.account_not_posting",
        message: `Account "${line.accountCode}" is not a posting account.`,
        path: `${path}.accountCode`
      });
    }

    if (line.invoiceId && line.supplierInvoiceId) {
      issues.push({
        code: "journal.line_conflicting_documents",
        message: "A journal line cannot reference both invoiceId and supplierInvoiceId.",
        path
      });
    }

    const amount = parseMoneyAmount(line.amount);
    if (!amount.ok) {
      issues.push({
        code: "journal.amount_invalid",
        message: `Journal line amount "${line.amount}" is invalid.`,
        path: `${path}.amount`
      });
    } else {
      totals[line.side].push(amount.minorUnits);
    }

    if (!line.currency) {
      issues.push({
        code: "journal.currency_missing",
        message: "Journal line currency is required.",
        path: `${path}.currency`
      });
    } else if (currency === null) {
      currency = line.currency;
    } else if (line.currency !== currency) {
      issues.push({
        code: "journal.currency_mismatch",
        message: "All journal lines in one entry must use the same currency.",
        path: `${path}.currency`
      });
    }
  });

  const debitTotal = addMinorUnits(totals.debit);
  const creditTotal = addMinorUnits(totals.credit);

  if (compareMinorUnits(debitTotal, creditTotal) !== 0) {
    issues.push({
      code: "journal.unbalanced",
      message: "Total debit must equal total credit.",
      path: "lines"
    });
  }

  return issues.length === 0 ? valid() : invalid(issues);
}
