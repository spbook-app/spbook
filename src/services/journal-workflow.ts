import type { JournalEntry, JournalLine, JournalLineSide } from "../domain";
import { validateJournalEntry } from "../domain";
import { defaultWorkflowStorage, type WorkflowStorage } from "../storage/workflow-persistence";
import { loadLedgerSlice } from "./workspace-overview";

export type UpdateJournalEntryLineInput = {
  accountCode: string;
  side: JournalLineSide;
  amount: string;
  currency: string;
  partyId?: string;
  invoiceId?: string;
  supplierInvoiceId?: string;
  bankAccountId?: string;
  taxPeriod?: string;
};

export type UpdateJournalEntryInput = {
  journalEntryId: string;
  description: string;
  entryDate: string;
  lines: UpdateJournalEntryLineInput[];
};

export async function updateJournalEntry(
  input: UpdateJournalEntryInput,
  storage: WorkflowStorage = defaultWorkflowStorage
) {
  const existing = await storage.repos.journalEntries.getById(input.journalEntryId);

  if (!existing) {
    throw new Error(`Journal entry "${input.journalEntryId}" was not found.`);
  }

  const accounts = await storage.repos.accounts.getByWorkspaceId(existing.workspaceId);

  const lines: JournalLine[] = input.lines.map((line) => ({
    accountCode: line.accountCode.trim(),
    side: line.side,
    amount: line.amount.trim(),
    currency: line.currency.trim(),
    partyId: line.partyId || undefined,
    invoiceId: line.invoiceId || undefined,
    supplierInvoiceId: line.supplierInvoiceId || undefined,
    bankAccountId: line.bankAccountId || undefined,
    taxPeriod: line.taxPeriod || undefined
  }));

  const updated: JournalEntry = {
    ...existing,
    description: input.description.trim(),
    entryDate: input.entryDate.trim(),
    lines
  };

  const validation = validateJournalEntry(updated, accounts);

  if (!validation.ok) {
    throw new Error(validation.issues[0]?.message ?? "Journal entry is invalid.");
  }

  await storage.repos.journalEntries.save(updated);

  return loadLedgerSlice(existing.workspaceId, storage.repos);
}
