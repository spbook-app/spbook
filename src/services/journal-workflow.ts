import type { JournalEntry, JournalLine, JournalLineSide } from "../domain";
import { validateJournalEntry } from "../domain";
import { db, type SpbookDatabase } from "../storage/db";
import {
  getAccountsByWorkspaceId,
  getJournalEntryById,
  saveJournalEntry
} from "../storage/repositories";
import { loadWorkspaceOverview } from "./workspace-overview";

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
  database: SpbookDatabase = db
) {
  const existing = await getJournalEntryById(input.journalEntryId, database);

  if (!existing) {
    throw new Error(`Journal entry "${input.journalEntryId}" was not found.`);
  }

  const accounts = await getAccountsByWorkspaceId(existing.workspaceId, database);

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

  await saveJournalEntry(updated, database);

  return loadWorkspaceOverview(existing.workspaceId, database);
}
