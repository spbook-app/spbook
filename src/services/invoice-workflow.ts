import type { Invoice, JournalEntry } from "../domain";
import {
  assertInvoiceIsDraft,
  assertInvoiceIsIssued,
  assertInvoiceIsNotPaid,
  validateInvoice,
  validateJournalEntry
} from "../domain";
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
  const parties = await repos.parties.getByWorkspaceId(input.workspaceId);
  const invoice = createDraftInvoice(input);
  const invoiceValidation = validateInvoice(invoice, parties);

  if (!invoiceValidation.ok) {
    throw new Error("Invoice data is invalid.");
  }

  await repos.invoices.save(invoice);

  const [invoicesSlice, ledgerSlice] = await Promise.all([
    loadInvoicesSlice(input.workspaceId, invoice, repos),
    loadLedgerSlice(input.workspaceId, repos)
  ]);
  return { ...invoicesSlice, ...ledgerSlice };
}

export async function issueSalesInvoice(
  invoiceId: string,
  storage: WorkflowStorage = defaultWorkflowStorage
) {
  const repos = storage.repos;
  const invoice = await repos.invoices.getById(invoiceId);

  if (!invoice) {
    throw new Error(`Invoice "${invoiceId}" was not found.`);
  }

  assertInvoiceIsDraft(invoice);

  const accounts = await repos.accounts.getByWorkspaceId(invoice.workspaceId);
  const issuedInvoice: Invoice = { ...invoice, status: "issued" };
  const journalEntry = createInvoiceJournalEntry(invoice, invoice.id);
  const journalValidation = validateJournalEntry(journalEntry, accounts);

  if (!journalValidation.ok) {
    throw new Error("Invoice journal entry is invalid.");
  }

  await storage.persistence.saveInvoiceJournalEntryData({ invoice: issuedInvoice, journalEntry });

  const [invoicesSlice, ledgerSlice] = await Promise.all([
    loadInvoicesSlice(invoice.workspaceId, issuedInvoice, repos),
    loadLedgerSlice(invoice.workspaceId, repos)
  ]);
  return { ...invoicesSlice, ...ledgerSlice };
}

export async function unissueSalesInvoice(
  invoiceId: string,
  storage: WorkflowStorage = defaultWorkflowStorage
) {
  const repos = storage.repos;
  const invoice = await repos.invoices.getById(invoiceId);

  if (!invoice) {
    throw new Error(`Invoice "${invoiceId}" was not found.`);
  }

  assertInvoiceIsIssued(invoice);
  assertInvoiceIsNotPaid(invoice);

  const journalEntries = await repos.journalEntries.getByWorkspaceId(invoice.workspaceId);
  const invoiceJournalEntry = journalEntries.find(
    (entry) => entry.sourceType === "invoice" && entry.sourceId === invoice.id
  );

  if (!invoiceJournalEntry) {
    throw new Error(`Journal entry for invoice "${invoiceId}" was not found.`);
  }

  const draftInvoice: Invoice = { ...invoice, status: "draft" };
  await storage.persistence.revertInvoiceToDraft({ invoice: draftInvoice, journalEntryId: invoiceJournalEntry.id });

  const [invoicesSlice, ledgerSlice] = await Promise.all([
    loadInvoicesSlice(invoice.workspaceId, draftInvoice, repos),
    loadLedgerSlice(invoice.workspaceId, repos)
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

  assertInvoiceIsIssued(invoice);

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

  assertInvoiceIsDraft(existingInvoice);

  const parties = await repos.parties.getByWorkspaceId(existingInvoice.workspaceId);
  const updatedInvoice: Invoice = {
    ...existingInvoice,
    number: input.number.trim(),
    issueDate: input.issueDate,
    partyId: input.partyId,
    total: input.total
  };
  const invoiceValidation = validateInvoice(updatedInvoice, parties);

  if (!invoiceValidation.ok) {
    throw new Error("Invoice data is invalid.");
  }

  await repos.invoices.save(updatedInvoice);

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

  assertInvoiceIsDraft(invoice);

  const invoices = await repos.invoices.getByWorkspaceId(invoice.workspaceId);

  await storage.persistence.deleteInvoiceWorkflowData({
    invoiceId: invoice.id,
    journalEntryIds: []
  });

  const nextInvoice = invoices.find((candidate) => candidate.id !== invoice.id);

  const [invoicesSlice, ledgerSlice] = await Promise.all([
    loadInvoicesSlice(invoice.workspaceId, nextInvoice, repos),
    loadLedgerSlice(invoice.workspaceId, repos)
  ]);
  return { ...invoicesSlice, ...ledgerSlice };
}

function createDraftInvoice(input: CreateSalesInvoiceInput): Invoice {
  return {
    id: createEntityId("inv"),
    workspaceId: input.workspaceId,
    number: input.number.trim(),
    issueDate: input.issueDate,
    partyId: input.partyId,
    currency: input.currency,
    total: input.total,
    status: "draft"
  };
}

function createInvoiceJournalEntry(
  invoice: Invoice,
  invoiceId: string
): JournalEntry {
  return {
    id: createEntityId("je_invoice"),
    workspaceId: invoice.workspaceId,
    entryDate: invoice.issueDate,
    sourceType: "invoice",
    sourceId: invoiceId,
    description: `Sales invoice ${invoice.number} issued`,
    lines: [
      {
        accountCode: "1200",
        side: "debit",
        amount: invoice.total,
        currency: invoice.currency,
        partyId: invoice.partyId,
        invoiceId
      },
      {
        accountCode: "7600",
        side: "credit",
        amount: invoice.total,
        currency: invoice.currency,
        partyId: invoice.partyId
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

