import type { JournalEntry, SupplierInvoice } from "../domain";
import { validateJournalEntry, validateSupplierInvoice } from "../domain";
import { defaultWorkflowStorage, type WorkflowStorage } from "../storage/workflow-persistence";
import { loadSupplierInvoicesSlice, loadLedgerSlice } from "./workspace-overview";
import type { WorkspaceDataUpdate } from "../shared/model/workspace";

export type CreateSupplierInvoiceInput = {
  workspaceId: string;
  partyId: string;
  number: string;
  issueDate: string;
  total: string;
  currency: string;
  expenseAccountCode?: string;
};

export type UpdateSupplierInvoiceInput = {
  supplierInvoiceId: string;
  partyId: string;
  number: string;
  issueDate: string;
  total: string;
  expenseAccountCode?: string;
};

export async function createSupplierInvoice(
  input: CreateSupplierInvoiceInput,
  storage: WorkflowStorage = defaultWorkflowStorage
) {
  const repos = storage.repos;
  const [accounts, parties] = await Promise.all([
    repos.accounts.getByWorkspaceId(input.workspaceId),
    repos.parties.getByWorkspaceId(input.workspaceId)
  ]);
  const supplierInvoice = createReceivedSupplierInvoice(input);
  const journalEntry = createSupplierInvoiceJournalEntry(
    supplierInvoice,
    input.partyId
  );
  const supplierInvoiceValidation = validateSupplierInvoice(supplierInvoice, parties);

  if (!supplierInvoiceValidation.ok) {
    throw new Error("Supplier invoice data is invalid.");
  }

  const journalValidation = validateJournalEntry(journalEntry, accounts);

  if (!journalValidation.ok) {
    throw new Error("Supplier invoice journal entry is invalid.");
  }

  await storage.persistence.saveSupplierInvoiceJournalEntryData({ supplierInvoice, journalEntry });

  const [supplierInvoicesSlice, ledgerSlice] = await Promise.all([
    loadSupplierInvoicesSlice(input.workspaceId, supplierInvoice, repos),
    loadLedgerSlice(input.workspaceId, repos)
  ]);
  return { ...supplierInvoicesSlice, ...ledgerSlice };
}

export async function recordSupplierPayment(
  supplierInvoiceId: string,
  storage: WorkflowStorage = defaultWorkflowStorage
) {
  const repos = storage.repos;
  const supplierInvoice = await repos.supplierInvoices.getById(supplierInvoiceId);

  if (!supplierInvoice) {
    throw new Error(`Supplier invoice "${supplierInvoiceId}" was not found.`);
  }

  if (supplierInvoice.status === "paid") {
    const [supplierInvoicesSlice, ledgerSlice] = await Promise.all([
      loadSupplierInvoicesSlice(supplierInvoice.workspaceId, supplierInvoice, repos),
      loadLedgerSlice(supplierInvoice.workspaceId, repos)
    ]);
    return { ...supplierInvoicesSlice, ...ledgerSlice };
  }

  const accounts = await repos.accounts.getByWorkspaceId(
    supplierInvoice.workspaceId
  );
  const journalEntry = createSupplierPaymentJournalEntry(supplierInvoice);
  const paidSupplierInvoice: SupplierInvoice = {
    ...supplierInvoice,
    status: "paid"
  };
  const journalValidation = validateJournalEntry(journalEntry, accounts);

  if (!journalValidation.ok) {
    throw new Error("Supplier payment journal entry is invalid.");
  }

  await storage.persistence.saveSupplierInvoicePaymentData(
    { supplierInvoice: paidSupplierInvoice, journalEntry }
  );

  const [supplierInvoicesSlice, ledgerSlice] = await Promise.all([
    loadSupplierInvoicesSlice(supplierInvoice.workspaceId, paidSupplierInvoice, repos),
    loadLedgerSlice(supplierInvoice.workspaceId, repos)
  ]);
  return { ...supplierInvoicesSlice, ...ledgerSlice };
}

export async function updateSupplierInvoice(
  input: UpdateSupplierInvoiceInput,
  storage: WorkflowStorage = defaultWorkflowStorage
) {
  const repos = storage.repos;
  const existingSupplierInvoice = await repos.supplierInvoices.getById(
    input.supplierInvoiceId
  );

  if (!existingSupplierInvoice) {
    throw new Error(`Supplier invoice "${input.supplierInvoiceId}" was not found.`);
  }

  if (existingSupplierInvoice.status === "paid") {
    throw new Error("Paid supplier invoice cannot be edited. Undo payment first.");
  }

  const [accounts, parties, journalEntries] = await Promise.all([
    repos.accounts.getByWorkspaceId(existingSupplierInvoice.workspaceId),
    repos.parties.getByWorkspaceId(existingSupplierInvoice.workspaceId),
    repos.journalEntries.getByWorkspaceId(existingSupplierInvoice.workspaceId)
  ]);
  const updatedSupplierInvoice: SupplierInvoice = {
    ...existingSupplierInvoice,
    number: input.number.trim(),
    issueDate: input.issueDate,
    partyId: input.partyId,
    total: input.total,
    expenseAccountCode: input.expenseAccountCode ?? existingSupplierInvoice.expenseAccountCode
  };
  const sourceJournalEntry = journalEntries.find(
    (entry) =>
      entry.sourceType === "supplier_invoice" &&
      entry.sourceId === existingSupplierInvoice.id
  );
  const journalEntry = {
    ...createSupplierInvoiceJournalEntry(updatedSupplierInvoice, input.partyId),
    id: sourceJournalEntry?.id ?? createEntityId("je_supplier_invoice")
  };
  const invoiceValidation = validateSupplierInvoice(updatedSupplierInvoice, parties);

  if (!invoiceValidation.ok) {
    throw new Error("Supplier invoice data is invalid.");
  }

  const journalValidation = validateJournalEntry(journalEntry, accounts);

  if (!journalValidation.ok) {
    throw new Error("Supplier invoice journal entry is invalid.");
  }

  await storage.persistence.saveSupplierInvoiceJournalEntryData(
    { supplierInvoice: updatedSupplierInvoice, journalEntry }
  );

  const [supplierInvoicesSlice, ledgerSlice] = await Promise.all([
    loadSupplierInvoicesSlice(existingSupplierInvoice.workspaceId, updatedSupplierInvoice, repos),
    loadLedgerSlice(existingSupplierInvoice.workspaceId, repos)
  ]);
  return { ...supplierInvoicesSlice, ...ledgerSlice };
}

export async function deleteSupplierInvoice(
  supplierInvoiceId: string,
  storage: WorkflowStorage = defaultWorkflowStorage
) {
  const repos = storage.repos;
  const supplierInvoice = await repos.supplierInvoices.getById(supplierInvoiceId);

  if (!supplierInvoice) {
    throw new Error(`Supplier invoice "${supplierInvoiceId}" was not found.`);
  }

  if (supplierInvoice.status === "paid") {
    throw new Error("Paid supplier invoice cannot be deleted. Undo payment first.");
  }

  const [supplierInvoices, journalEntries] = await Promise.all([
    repos.supplierInvoices.getByWorkspaceId(supplierInvoice.workspaceId),
    repos.journalEntries.getByWorkspaceId(supplierInvoice.workspaceId)
  ]);
  const supplierInvoiceJournalEntryIds = journalEntries
    .filter((entry) =>
      entry.lines.some((line) => line.supplierInvoiceId === supplierInvoice.id)
    )
    .map((entry) => entry.id);

  await storage.persistence.deleteSupplierInvoiceWorkflowData({
    supplierInvoiceId: supplierInvoice.id,
    journalEntryIds: supplierInvoiceJournalEntryIds
  });

  const nextSupplierInvoice = supplierInvoices.find(
    (candidate) => candidate.id !== supplierInvoice.id
  );

  const [supplierInvoicesSlice, ledgerSlice] = await Promise.all([
    loadSupplierInvoicesSlice(supplierInvoice.workspaceId, nextSupplierInvoice, repos),
    loadLedgerSlice(supplierInvoice.workspaceId, repos)
  ]);
  return { ...supplierInvoicesSlice, ...ledgerSlice };
}

function createReceivedSupplierInvoice(
  input: CreateSupplierInvoiceInput
): SupplierInvoice {
  return {
    id: createEntityId("sinv"),
    workspaceId: input.workspaceId,
    number: input.number.trim(),
    issueDate: input.issueDate,
    partyId: input.partyId,
    currency: input.currency,
    total: input.total,
    expenseAccountCode: input.expenseAccountCode ?? "4100",
    status: "received"
  };
}

function createSupplierInvoiceJournalEntry(
  supplierInvoice: SupplierInvoice,
  partyId: string
): JournalEntry {
  return {
    id: createEntityId("je_supplier_invoice"),
    workspaceId: supplierInvoice.workspaceId,
    entryDate: supplierInvoice.issueDate,
    sourceType: "supplier_invoice",
    sourceId: supplierInvoice.id,
    description: `Supplier invoice ${supplierInvoice.number} received`,
    lines: [
      {
        accountCode: supplierInvoice.expenseAccountCode,
        side: "debit",
        amount: supplierInvoice.total,
        currency: supplierInvoice.currency,
        partyId,
        supplierInvoiceId: supplierInvoice.id
      },
      {
        accountCode: "2200",
        side: "credit",
        amount: supplierInvoice.total,
        currency: supplierInvoice.currency,
        partyId,
        supplierInvoiceId: supplierInvoice.id
      }
    ]
  };
}

function createSupplierPaymentJournalEntry(
  supplierInvoice: SupplierInvoice
): JournalEntry {
  return {
    id: createEntityId("je_supplier_payment"),
    workspaceId: supplierInvoice.workspaceId,
    entryDate: supplierInvoice.issueDate,
    sourceType: "supplier_payment",
    sourceId: supplierInvoice.id,
    description: `Supplier invoice ${supplierInvoice.number} paid`,
    lines: [
      {
        accountCode: "2200",
        side: "debit",
        amount: supplierInvoice.total,
        currency: supplierInvoice.currency,
        partyId: supplierInvoice.partyId,
        supplierInvoiceId: supplierInvoice.id
      },
      {
        accountCode: "1100",
        side: "credit",
        amount: supplierInvoice.total,
        currency: supplierInvoice.currency,
        partyId: supplierInvoice.partyId,
        supplierInvoiceId: supplierInvoice.id
      }
    ]
  };
}

function createEntityId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}
