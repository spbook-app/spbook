import type { Invoice, JournalEntry } from "../domain";
import { validateInvoice, validateJournalEntry } from "../domain";
import { defaultWorkflowStorage, type WorkflowStorage } from "../storage/workflow-persistence";
import { loadInvoicesSlice, loadLedgerSlice } from "./workspace-overview";
import type { WorkspaceDataUpdate } from "../shared/model/workspace";

export type CreateSalesInvoiceInput = {
  workspaceId: string;
  partyId: string;
  number: string;
  issueDate: string;
  total: string;
  currency: string;
};

export type UpdateSalesInvoiceInput = {
  invoiceId: string;
  partyId: string;
  number: string;
  issueDate: string;
  total: string;
};

export async function createSalesInvoice(
  input: CreateSalesInvoiceInput,
  storage: WorkflowStorage = defaultWorkflowStorage
) {
  const repos = storage.repos;
  const [accounts, parties] = await Promise.all([
    repos.accounts.getByWorkspaceId(input.workspaceId),
    repos.parties.getByWorkspaceId(input.workspaceId)
  ]);
  const invoice = createIssuedInvoice(input);
  const journalEntry = createInvoiceJournalEntry(input, invoice.id);
  const invoiceValidation = validateInvoice(invoice, parties);

  if (!invoiceValidation.ok) {
    throw new Error("Invoice data is invalid.");
  }

  const journalValidation = validateJournalEntry(journalEntry, accounts);

  if (!journalValidation.ok) {
    throw new Error("Invoice journal entry is invalid.");
  }

  await storage.persistence.saveInvoiceJournalEntryData({ invoice, journalEntry });

  const [invoicesSlice, ledgerSlice] = await Promise.all([
    loadInvoicesSlice(input.workspaceId, invoice, repos),
    loadLedgerSlice(input.workspaceId, repos)
  ]);
  return { ...invoicesSlice, ...ledgerSlice };
}

export async function recordInvoicePayment(
  invoiceId: string,
  storage: WorkflowStorage = defaultWorkflowStorage
) {
  const repos = storage.repos;
  const invoice = await repos.invoices.getById(invoiceId);

  if (!invoice) {
    throw new Error(`Invoice "${invoiceId}" was not found.`);
  }

  if (invoice.status === "paid") {
    const [invoicesSlice, ledgerSlice] = await Promise.all([
      loadInvoicesSlice(invoice.workspaceId, invoice, repos),
      loadLedgerSlice(invoice.workspaceId, repos)
    ]);
    return { ...invoicesSlice, ...ledgerSlice };
  }

  const accounts = await repos.accounts.getByWorkspaceId(invoice.workspaceId);
  const journalEntry = createPaymentJournalEntry(invoice);
  const paidInvoice: Invoice = { ...invoice, status: "paid" };
  const journalValidation = validateJournalEntry(journalEntry, accounts);

  if (!journalValidation.ok) {
    throw new Error("Payment journal entry is invalid.");
  }

  await storage.persistence.saveInvoicePaymentData({
    invoice: paidInvoice,
    journalEntry
  });

  const [invoicesSlice, ledgerSlice] = await Promise.all([
    loadInvoicesSlice(invoice.workspaceId, paidInvoice, repos),
    loadLedgerSlice(invoice.workspaceId, repos)
  ]);
  return { ...invoicesSlice, ...ledgerSlice };
}

export async function updateSalesInvoice(
  input: UpdateSalesInvoiceInput,
  storage: WorkflowStorage = defaultWorkflowStorage
) {
  const repos = storage.repos;
  const existingInvoice = await repos.invoices.getById(input.invoiceId);

  if (!existingInvoice) {
    throw new Error(`Invoice "${input.invoiceId}" was not found.`);
  }

  if (existingInvoice.status === "paid") {
    throw new Error("Paid invoice cannot be edited. Undo payment first.");
  }

  const [accounts, parties, journalEntries] = await Promise.all([
    repos.accounts.getByWorkspaceId(existingInvoice.workspaceId),
    repos.parties.getByWorkspaceId(existingInvoice.workspaceId),
    repos.journalEntries.getByWorkspaceId(existingInvoice.workspaceId)
  ]);
  const updatedInvoice: Invoice = {
    ...existingInvoice,
    number: input.number.trim(),
    issueDate: input.issueDate,
    partyId: input.partyId,
    total: input.total
  };
  const sourceJournalEntry = journalEntries.find(
    (entry) => entry.sourceType === "invoice" && entry.sourceId === existingInvoice.id
  );
  const journalEntry = {
    ...createInvoiceJournalEntry(
      {
        workspaceId: existingInvoice.workspaceId,
        partyId: input.partyId,
        number: input.number,
        issueDate: input.issueDate,
        total: input.total,
        currency: existingInvoice.currency
      },
      existingInvoice.id
    ),
    id: sourceJournalEntry?.id ?? createEntityId("je_invoice")
  };
  const invoiceValidation = validateInvoice(updatedInvoice, parties);

  if (!invoiceValidation.ok) {
    throw new Error("Invoice data is invalid.");
  }

  const journalValidation = validateJournalEntry(journalEntry, accounts);

  if (!journalValidation.ok) {
    throw new Error("Invoice journal entry is invalid.");
  }

  await storage.persistence.saveInvoiceJournalEntryData({ invoice: updatedInvoice, journalEntry });

  const [invoicesSlice, ledgerSlice] = await Promise.all([
    loadInvoicesSlice(existingInvoice.workspaceId, updatedInvoice, repos),
    loadLedgerSlice(existingInvoice.workspaceId, repos)
  ]);
  return { ...invoicesSlice, ...ledgerSlice };
}

export async function deleteSalesInvoice(
  invoiceId: string,
  storage: WorkflowStorage = defaultWorkflowStorage
) {
  const repos = storage.repos;
  const invoice = await repos.invoices.getById(invoiceId);

  if (!invoice) {
    throw new Error(`Invoice "${invoiceId}" was not found.`);
  }

  if (invoice.status === "paid") {
    throw new Error("Paid invoice cannot be deleted. Undo payment first.");
  }

  const [invoices, journalEntries] = await Promise.all([
    repos.invoices.getByWorkspaceId(invoice.workspaceId),
    repos.journalEntries.getByWorkspaceId(invoice.workspaceId)
  ]);
  const invoiceJournalEntryIds = journalEntries
    .filter((entry) => entry.lines.some((line) => line.invoiceId === invoice.id))
    .map((entry) => entry.id);

  await storage.persistence.deleteInvoiceWorkflowData({
    invoiceId: invoice.id,
    journalEntryIds: invoiceJournalEntryIds
  });

  const nextInvoice = invoices.find((candidate) => candidate.id !== invoice.id);

  const [invoicesSlice, ledgerSlice] = await Promise.all([
    loadInvoicesSlice(invoice.workspaceId, nextInvoice, repos),
    loadLedgerSlice(invoice.workspaceId, repos)
  ]);
  return { ...invoicesSlice, ...ledgerSlice };
}

function createIssuedInvoice(input: CreateSalesInvoiceInput): Invoice {
  return {
    id: createEntityId("inv"),
    workspaceId: input.workspaceId,
    number: input.number.trim(),
    issueDate: input.issueDate,
    partyId: input.partyId,
    currency: input.currency,
    total: input.total,
    status: "issued"
  };
}

function createInvoiceJournalEntry(
  input: CreateSalesInvoiceInput,
  invoiceId: string
): JournalEntry {
  return {
    id: createEntityId("je_invoice"),
    workspaceId: input.workspaceId,
    entryDate: input.issueDate,
    sourceType: "invoice",
    sourceId: invoiceId,
    description: `Sales invoice ${input.number.trim()} issued`,
    lines: [
      {
        accountCode: "1200",
        side: "debit",
        amount: input.total,
        currency: input.currency,
        partyId: input.partyId,
        invoiceId
      },
      {
        accountCode: "7600",
        side: "credit",
        amount: input.total,
        currency: input.currency,
        partyId: input.partyId
      }
    ]
  };
}

function createPaymentJournalEntry(invoice: Invoice): JournalEntry {
  return {
    id: createEntityId("je_payment"),
    workspaceId: invoice.workspaceId,
    entryDate: invoice.issueDate,
    sourceType: "invoice_payment",
    sourceId: invoice.id,
    description: `Sales invoice ${invoice.number} paid`,
    lines: [
      {
        accountCode: "1100",
        side: "debit",
        amount: invoice.total,
        currency: invoice.currency,
        partyId: invoice.partyId,
        invoiceId: invoice.id
      },
      {
        accountCode: "1200",
        side: "credit",
        amount: invoice.total,
        currency: invoice.currency,
        partyId: invoice.partyId,
        invoiceId: invoice.id
      }
    ]
  };
}

function createEntityId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}


