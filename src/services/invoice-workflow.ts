import type { Invoice, JournalEntry } from "../domain";
import { validateInvoice, validateJournalEntry } from "../domain";
import { db, type SpbookDatabase } from "../storage/db";
import {
  deleteInvoiceWorkflowData,
  getAccountsByWorkspaceId,
  getInvoiceById,
  getInvoicesByWorkspaceId,
  getJournalEntriesByWorkspaceId,
  getPartiesByWorkspaceId,
  saveInvoiceJournalEntryData,
  saveInvoicePaymentData,
} from "../storage/repositories";
import { loadWorkspaceOverview, type WorkspaceOverview } from "./workspace-overview";

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
  database: SpbookDatabase = db
) {
  const [accounts, parties] = await Promise.all([
    getAccountsByWorkspaceId(input.workspaceId, database),
    getPartiesByWorkspaceId(input.workspaceId, database)
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

  await saveInvoiceJournalEntryData({ invoice, journalEntry }, database);

  return selectInvoiceInOverview(
    await loadWorkspaceOverview(input.workspaceId, database),
    invoice
  );
}

export async function recordInvoicePayment(
  invoiceId: string,
  database: SpbookDatabase = db
) {
  const invoice = await getInvoiceById(invoiceId, database);

  if (!invoice) {
    throw new Error(`Invoice "${invoiceId}" was not found.`);
  }

  if (invoice.status === "paid") {
    return selectInvoiceInOverview(
      await loadWorkspaceOverview(invoice.workspaceId, database),
      invoice
    );
  }

  const accounts = await getAccountsByWorkspaceId(invoice.workspaceId, database);
  const journalEntry = createPaymentJournalEntry(invoice);
  const paidInvoice: Invoice = { ...invoice, status: "paid" };
  const journalValidation = validateJournalEntry(journalEntry, accounts);

  if (!journalValidation.ok) {
    throw new Error("Payment journal entry is invalid.");
  }

  await saveInvoicePaymentData(
    {
      invoice: paidInvoice,
      journalEntry
    },
    database
  );

  return selectInvoiceInOverview(
    await loadWorkspaceOverview(invoice.workspaceId, database),
    paidInvoice
  );
}

export async function updateSalesInvoice(
  input: UpdateSalesInvoiceInput,
  database: SpbookDatabase = db
) {
  const existingInvoice = await getInvoiceById(input.invoiceId, database);

  if (!existingInvoice) {
    throw new Error(`Invoice "${input.invoiceId}" was not found.`);
  }

  if (existingInvoice.status === "paid") {
    throw new Error("Paid invoice cannot be edited. Undo payment first.");
  }

  const [accounts, parties, journalEntries] = await Promise.all([
    getAccountsByWorkspaceId(existingInvoice.workspaceId, database),
    getPartiesByWorkspaceId(existingInvoice.workspaceId, database),
    getJournalEntriesByWorkspaceId(existingInvoice.workspaceId, database)
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

  await saveInvoiceJournalEntryData({ invoice: updatedInvoice, journalEntry }, database);

  return selectInvoiceInOverview(
    await loadWorkspaceOverview(existingInvoice.workspaceId, database),
    updatedInvoice
  );
}

export async function deleteSalesInvoice(
  invoiceId: string,
  database: SpbookDatabase = db
) {
  const invoice = await getInvoiceById(invoiceId, database);

  if (!invoice) {
    throw new Error(`Invoice "${invoiceId}" was not found.`);
  }

  if (invoice.status === "paid") {
    throw new Error("Paid invoice cannot be deleted. Undo payment first.");
  }

  const [invoices, journalEntries] = await Promise.all([
    getInvoicesByWorkspaceId(invoice.workspaceId, database),
    getJournalEntriesByWorkspaceId(invoice.workspaceId, database)
  ]);
  const invoiceJournalEntryIds = journalEntries
    .filter((entry) => entry.lines.some((line) => line.invoiceId === invoice.id))
    .map((entry) => entry.id);

  await deleteInvoiceWorkflowData(
    {
      invoiceId: invoice.id,
      journalEntryIds: invoiceJournalEntryIds
    },
    database
  );

  const nextInvoice = invoices.find((candidate) => candidate.id !== invoice.id);
  const overview = await loadWorkspaceOverview(invoice.workspaceId, database);

  return nextInvoice ? selectInvoiceInOverview(overview, nextInvoice) : overview;
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

function selectInvoiceInOverview(
  overview: WorkspaceOverview,
  invoice: Invoice
): WorkspaceOverview {
  return {
    ...overview,
    latestInvoice: invoice,
    latestInvoiceParty:
      overview.parties.find((party) => party.id === invoice.partyId) ?? null
  };
}
