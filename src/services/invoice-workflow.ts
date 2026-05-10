import type { Account, Invoice, JournalEntry, Party, Workspace } from "../domain";
import { validateInvoice, validateJournalEntry } from "../domain";
import { db, type SpbookDatabase } from "../storage/db";
import {
  getAccountsByWorkspaceId,
  getFirstWorkspace,
  getInvoiceById,
  getInvoicesByWorkspaceId,
  getJournalEntriesByWorkspaceId,
  getPartiesByWorkspaceId,
  saveInvoicePaymentData,
  saveInvoiceWorkflowData
} from "../storage/repositories";
import { calculateAccountBalances, type AccountBalance } from "./balances";

export type WorkspaceOverview = {
  workspace: Workspace;
  accounts: Account[];
  parties: Party[];
  invoices: Invoice[];
  latestInvoice: Invoice | null;
  latestInvoiceParty: Party | null;
  journalEntries: JournalEntry[];
  balances: AccountBalance[];
};

export type CreateSalesInvoiceInput = {
  workspaceId: string;
  customerName: string;
  number: string;
  issueDate: string;
  total: string;
  currency: string;
};

export async function loadWorkspaceOverview(
  workspaceId: string,
  database: SpbookDatabase = db
): Promise<WorkspaceOverview> {
  const workspace = await getFirstWorkspace(database);

  if (!workspace || workspace.id !== workspaceId) {
    throw new Error(`Workspace "${workspaceId}" was not found.`);
  }

  const [accounts, parties, invoices, journalEntries] = await Promise.all([
    getAccountsByWorkspaceId(workspaceId, database),
    getPartiesByWorkspaceId(workspaceId, database),
    getInvoicesByWorkspaceId(workspaceId, database),
    getJournalEntriesByWorkspaceId(workspaceId, database)
  ]);
  const latestInvoice = invoices.at(-1) ?? null;

  return {
    workspace,
    accounts,
    parties,
    invoices,
    latestInvoice,
    latestInvoiceParty: latestInvoice
      ? parties.find((party) => party.id === latestInvoice.partyId) ?? null
      : null,
    journalEntries,
    balances: calculateAccountBalances(journalEntries)
  };
}

export async function createSalesInvoice(
  input: CreateSalesInvoiceInput,
  database: SpbookDatabase = db
) {
  const accounts = await getAccountsByWorkspaceId(input.workspaceId, database);
  const party = createCustomerParty(input);
  const invoice = createIssuedInvoice(input, party.id);
  const journalEntry = createInvoiceJournalEntry(input, party.id, invoice.id);
  const invoiceValidation = validateInvoice(invoice, [party]);

  if (!invoiceValidation.ok) {
    throw new Error("Invoice data is invalid.");
  }

  const journalValidation = validateJournalEntry(journalEntry, accounts);

  if (!journalValidation.ok) {
    throw new Error("Invoice journal entry is invalid.");
  }

  await saveInvoiceWorkflowData({ party, invoice, journalEntry }, database);

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

function createCustomerParty(input: CreateSalesInvoiceInput): Party {
  return {
    id: createEntityId("party"),
    workspaceId: input.workspaceId,
    name: input.customerName.trim(),
    countryCode: "SI",
    type: "business",
    roles: ["customer"],
    active: true
  };
}

function createIssuedInvoice(input: CreateSalesInvoiceInput, partyId: string): Invoice {
  return {
    id: createEntityId("inv"),
    workspaceId: input.workspaceId,
    number: input.number.trim(),
    issueDate: input.issueDate,
    partyId,
    currency: input.currency,
    total: input.total,
    status: "issued"
  };
}

function createInvoiceJournalEntry(
  input: CreateSalesInvoiceInput,
  partyId: string,
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
        partyId,
        invoiceId
      },
      {
        accountCode: "7600",
        side: "credit",
        amount: input.total,
        currency: input.currency,
        partyId
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
