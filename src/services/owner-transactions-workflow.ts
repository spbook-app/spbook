import type { JournalEntry, Party } from "../domain";
import { validateJournalEntry } from "../domain";
import { defaultWorkflowStorage, type WorkflowStorage } from "../storage/workflow-persistence";
import { loadLedgerSlice } from "./workspace-overview";

export type OwnerTransactionInput = {
  workspaceId: string;
  entryDate: string;
  amount: string;
  currency: string;
};

export async function recordOwnerContribution(
  input: OwnerTransactionInput,
  storage: WorkflowStorage = defaultWorkflowStorage
) {
  return recordOwnerTransaction(input, "contribution", storage);
}

export async function recordOwnerWithdrawal(
  input: OwnerTransactionInput,
  storage: WorkflowStorage = defaultWorkflowStorage
) {
  return recordOwnerTransaction(input, "withdrawal", storage);
}

async function recordOwnerTransaction(
  input: OwnerTransactionInput,
  transactionType: "contribution" | "withdrawal",
  storage: WorkflowStorage
) {
  const accounts = await storage.repos.accounts.getByWorkspaceId(input.workspaceId);
  const owner = createOwnerParty(input.workspaceId);
  const journalEntry = createOwnerJournalEntry(input, owner.id, transactionType);
  const journalValidation = validateJournalEntry(journalEntry, accounts);

  if (!journalValidation.ok) {
    throw new Error("Owner transaction journal entry is invalid.");
  }

  await storage.persistence.savePartyJournalEntryData({ party: owner, journalEntry });

  return loadLedgerSlice(input.workspaceId, storage.repos);
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
