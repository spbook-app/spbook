import type { BankTransaction, Party } from "../../domain";

export type BankTransactionProcessingState =
  | "needs_counterparty"
  | "linked_needs_match"
  | "invoice_candidate"
  | "supplier_invoice_candidate"
  | "matched_sales_invoice"
  | "matched_supplier_invoice"
  | "posted_bank_fee"
  | "ignored"
  | "manual_unmatched";

export type BankTransactionDisplayTone = "neutral" | "warning" | "success" | "info";

export type BankTransactionDisplayState = {
  processingState: BankTransactionProcessingState;
  label: string;
  tone: BankTransactionDisplayTone;
  isImported: boolean;
};

export function getBankTransactionDisplayState(
  bankTransaction: BankTransaction,
  linkedParty: Party | undefined,
  invoiceCandidateExists: boolean,
  supplierInvoiceCandidateExists: boolean
): BankTransactionDisplayState {
  const isImported = Boolean(bankTransaction.importSource);
  const isIncoming = !bankTransaction.amount.startsWith("-");

  if (bankTransaction.status === "ignored") {
    return { processingState: "ignored", label: "Ignored", tone: "neutral", isImported };
  }

  if (bankTransaction.status === "matched") {
    if (bankTransaction.matchedDocumentType === "invoice") {
      return {
        processingState: "matched_sales_invoice",
        label: "Matched sales invoice",
        tone: "success",
        isImported
      };
    }
    if (bankTransaction.matchedDocumentType === "supplier_invoice") {
      return {
        processingState: "matched_supplier_invoice",
        label: "Matched supplier invoice",
        tone: "success",
        isImported
      };
    }
  }

  if (bankTransaction.status === "posted") {
    return {
      processingState: "posted_bank_fee",
      label: "Bank fee posted",
      tone: "info",
      isImported
    };
  }

  // status === "unmatched"
  if (!bankTransaction.partyId) {
    if (!isImported) {
      return {
        processingState: "manual_unmatched",
        label: "Manual transaction",
        tone: "neutral",
        isImported
      };
    }
    return {
      processingState: "needs_counterparty",
      label: "Needs counterparty",
      tone: "warning",
      isImported
    };
  }

  if (isIncoming && invoiceCandidateExists) {
    return {
      processingState: "invoice_candidate",
      label: "Invoice candidate",
      tone: "info",
      isImported
    };
  }

  if (!isIncoming && supplierInvoiceCandidateExists) {
    return {
      processingState: "supplier_invoice_candidate",
      label: "Supplier invoice candidate",
      tone: "info",
      isImported
    };
  }

  return {
    processingState: "linked_needs_match",
    label: "Ready to match",
    tone: "warning",
    isImported
  };
}

/** Selectable quick filters, excluding the empty "All" sentinel. */
export const bankTransactionQuickFilters = [
  "needs_action",
  "needs_counterparty",
  "linked_needs_match",
  "invoice_candidate",
  "supplier_invoice_candidate",
  "matched",
  "posted_bank_fee",
  "ignored",
  "imported",
  "manual_unmatched"
] as const;

export type BankTransactionQuickFilterValue = (typeof bankTransactionQuickFilters)[number];

/** Mirrors the "needs_action" quick filter: unmatched, excluding manual transactions without a counterparty. */
export function requiresBankTransactionAction(bankTransaction: BankTransaction): boolean {
  return (
    bankTransaction.status === "unmatched" &&
    Boolean(bankTransaction.partyId || bankTransaction.importSource)
  );
}

export function matchesQuickFilter(
  processingState: BankTransactionProcessingState,
  isImported: boolean,
  filter: BankTransactionQuickFilterValue
): boolean {
  if (filter === "needs_action") {
    return (
      processingState === "needs_counterparty" ||
      processingState === "linked_needs_match" ||
      processingState === "invoice_candidate" ||
      processingState === "supplier_invoice_candidate"
    );
  }
  if (filter === "matched") {
    return (
      processingState === "matched_sales_invoice" ||
      processingState === "matched_supplier_invoice"
    );
  }
  if (filter === "imported") return isImported;
  return processingState === filter;
}
