import type { JournalEntry, Party } from "../domain";
import { validateJournalEntry } from "../domain";
import { db, type SpbookDatabase } from "../storage/db";
import {
  getAccountsByWorkspaceId,
  savePartyJournalEntryData
} from "../storage/repositories";
import { loadWorkspaceOverview } from "./workspace-overview";

export type OwnerTransactionInput = {
  workspaceId: string;
  entryDate: string;
  amount: string;
  currency: string;
};

export async function recordOwnerContribution(
  input: OwnerTransactionInput,
  database: SpbookDatabase = db
) {
  return recordOwnerTransaction(input, "contribution", database);
}

export async function recordOwnerWithdrawal(
  input: OwnerTransactionInput,
  database: SpbookDatabase = db
) {
  return recordOwnerTransaction(input, "withdrawal", database);
}

async function recordOwnerTransaction(
  input: OwnerTransactionInput,
  transactionType: "contribution" | "withdrawal",
  database: SpbookDatabase
) {
  const accounts = await getAccountsByWorkspaceId(input.workspaceId, database);
  const owner = createOwnerParty(input.workspaceId);
  const journalEntry = createOwnerJournalEntry(input, owner.id, transactionType);
  const journalValidation = validateJournalEntry(journalEntry, accounts);

  if (!journalValidation.ok) {
    throw new Error("Owner transaction journal entry is invalid.");
  }

  await savePartyJournalEntryData({ party: owner, journalEntry }, database);

  return loadWorkspaceOverview(input.workspaceId, database);
}

function createOwnerParty(workspaceId: string): Party {
  return {
    id: `party_owner_${workspaceId}`,
    workspaceId,
    name: "Owner",
    countryCode: "SI",
    type: "person",
    roles: ["owner"],
    active: true
  };
}

function createOwnerJournalEntry(
  input: OwnerTransactionInput,
  partyId: string,
  transactionType: "contribution" | "withdrawal"
): JournalEntry {
  const isContribution = transactionType === "contribution";

  return {
    id: createEntityId(`je_owner_${transactionType}`),
    workspaceId: input.workspaceId,
    entryDate: input.entryDate,
    sourceType: `owner_${transactionType}`,
    description: isContribution ? "Owner contribution" : "Owner withdrawal",
    lines: [
      {
        accountCode: isContribution ? "1100" : "2850",
        side: "debit",
        amount: input.amount,
        currency: input.currency,
        partyId
      },
      {
        accountCode: isContribution ? "2850" : "1100",
        side: "credit",
        amount: input.amount,
        currency: input.currency,
        partyId
      }
    ]
  };
}

function createEntityId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}
