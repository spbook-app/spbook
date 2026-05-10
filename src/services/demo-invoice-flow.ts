import type { Invoice, JournalEntry, Party } from "../domain";
import { validateInvoice, validateJournalEntry } from "../domain";
import { db, type SpbookDatabase } from "../storage/db";
import {
  getAccountsByWorkspaceId,
  getJournalEntriesByWorkspaceId,
  saveDemoInvoiceFlowData
} from "../storage/repositories";
import { calculateAccountBalances, type AccountBalance } from "./balances";

export const DEMO_CUSTOMER_PARTY_ID = "party_demo_customer";
export const DEMO_INVOICE_ID = "inv_demo_2026_0001";
export const DEMO_INVOICE_JOURNAL_ENTRY_ID = "je_demo_invoice_2026_0001";
export const DEMO_PAYMENT_JOURNAL_ENTRY_ID = "je_demo_payment_2026_0001";

export type DemoInvoicePaymentFlowResult = {
  party: Party;
  invoice: Invoice;
  journalEntries: JournalEntry[];
  balances: AccountBalance[];
};

export async function runDemoInvoicePaymentFlow(
  workspaceId: string,
  database: SpbookDatabase = db
): Promise<DemoInvoicePaymentFlowResult> {
  const accounts = await getAccountsByWorkspaceId(workspaceId, database);
  const party = createDemoCustomerParty(workspaceId);
  const invoice = createDemoPaidInvoice(workspaceId, party.id);
  const journalEntries = [
    createDemoInvoiceJournalEntry(workspaceId, party.id, invoice.id),
    createDemoPaymentJournalEntry(workspaceId, party.id, invoice.id)
  ];
  const invoiceValidation = validateInvoice(invoice, [party]);

  if (!invoiceValidation.ok) {
    throw new Error("Generated demo invoice is invalid.");
  }

  for (const journalEntry of journalEntries) {
    const journalValidation = validateJournalEntry(journalEntry, accounts);

    if (!journalValidation.ok) {
      throw new Error(`Generated journal entry "${journalEntry.id}" is invalid.`);
    }
  }

  await saveDemoInvoiceFlowData({ party, invoice, journalEntries }, database);

  return {
    party,
    invoice,
    journalEntries,
    balances: calculateAccountBalances(await getJournalEntriesByWorkspaceId(workspaceId, database))
  };
}

function createDemoCustomerParty(workspaceId: string): Party {
  return {
    id: DEMO_CUSTOMER_PARTY_ID,
    workspaceId,
    name: "Demo Customer d.o.o.",
    countryCode: "SI",
    type: "business",
    roles: ["customer"],
    active: true
  };
}

function createDemoPaidInvoice(workspaceId: string, partyId: string): Invoice {
  return {
    id: DEMO_INVOICE_ID,
    workspaceId,
    number: "2026-0001",
    issueDate: "2026-04-01",
    partyId,
    currency: "EUR",
    total: "1000.00",
    status: "paid"
  };
}

function createDemoInvoiceJournalEntry(
  workspaceId: string,
  partyId: string,
  invoiceId: string
): JournalEntry {
  return {
    id: DEMO_INVOICE_JOURNAL_ENTRY_ID,
    workspaceId,
    entryDate: "2026-04-01",
    sourceType: "invoice",
    sourceId: invoiceId,
    description: "Demo invoice issued",
    lines: [
      {
        accountCode: "1200",
        side: "debit",
        amount: "1000.00",
        currency: "EUR",
        partyId,
        invoiceId
      },
      {
        accountCode: "7600",
        side: "credit",
        amount: "1000.00",
        currency: "EUR",
        partyId
      }
    ]
  };
}

function createDemoPaymentJournalEntry(
  workspaceId: string,
  partyId: string,
  invoiceId: string
): JournalEntry {
  return {
    id: DEMO_PAYMENT_JOURNAL_ENTRY_ID,
    workspaceId,
    entryDate: "2026-04-02",
    sourceType: "invoice_payment",
    sourceId: invoiceId,
    description: "Demo invoice paid",
    lines: [
      {
        accountCode: "1100",
        side: "debit",
        amount: "1000.00",
        currency: "EUR",
        partyId,
        invoiceId
      },
      {
        accountCode: "1200",
        side: "credit",
        amount: "1000.00",
        currency: "EUR",
        partyId,
        invoiceId
      }
    ]
  };
}
