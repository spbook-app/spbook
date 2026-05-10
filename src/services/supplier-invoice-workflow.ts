import type { JournalEntry, Party, SupplierInvoice } from "../domain";
import { validateJournalEntry, validateSupplierInvoice } from "../domain";
import { db, type SpbookDatabase } from "../storage/db";
import {
  getAccountsByWorkspaceId,
  getSupplierInvoiceById,
  saveSupplierInvoicePaymentData,
  saveSupplierInvoiceWorkflowData
} from "../storage/repositories";
import { loadWorkspaceOverview, type WorkspaceOverview } from "./workspace-overview";

export type CreateSupplierInvoiceInput = {
  workspaceId: string;
  supplierName: string;
  number: string;
  issueDate: string;
  total: string;
  currency: string;
  expenseAccountCode?: string;
};

export async function createSupplierInvoice(
  input: CreateSupplierInvoiceInput,
  database: SpbookDatabase = db
) {
  const accounts = await getAccountsByWorkspaceId(input.workspaceId, database);
  const supplier = createSupplierParty(input);
  const supplierInvoice = createReceivedSupplierInvoice(input, supplier.id);
  const journalEntry = createSupplierInvoiceJournalEntry(
    supplierInvoice,
    supplier.id
  );
  const supplierInvoiceValidation = validateSupplierInvoice(supplierInvoice, [supplier]);

  if (!supplierInvoiceValidation.ok) {
    throw new Error("Supplier invoice data is invalid.");
  }

  const journalValidation = validateJournalEntry(journalEntry, accounts);

  if (!journalValidation.ok) {
    throw new Error("Supplier invoice journal entry is invalid.");
  }

  await saveSupplierInvoiceWorkflowData(
    { supplier, supplierInvoice, journalEntry },
    database
  );

  return selectSupplierInvoiceInOverview(
    await loadWorkspaceOverview(input.workspaceId, database),
    supplierInvoice
  );
}

export async function recordSupplierPayment(
  supplierInvoiceId: string,
  database: SpbookDatabase = db
) {
  const supplierInvoice = await getSupplierInvoiceById(supplierInvoiceId, database);

  if (!supplierInvoice) {
    throw new Error(`Supplier invoice "${supplierInvoiceId}" was not found.`);
  }

  if (supplierInvoice.status === "paid") {
    return selectSupplierInvoiceInOverview(
      await loadWorkspaceOverview(supplierInvoice.workspaceId, database),
      supplierInvoice
    );
  }

  const accounts = await getAccountsByWorkspaceId(
    supplierInvoice.workspaceId,
    database
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

  await saveSupplierInvoicePaymentData(
    { supplierInvoice: paidSupplierInvoice, journalEntry },
    database
  );

  return selectSupplierInvoiceInOverview(
    await loadWorkspaceOverview(supplierInvoice.workspaceId, database),
    paidSupplierInvoice
  );
}

function createSupplierParty(input: CreateSupplierInvoiceInput): Party {
  return {
    id: createEntityId("party"),
    workspaceId: input.workspaceId,
    name: input.supplierName.trim(),
    countryCode: "SI",
    type: "business",
    roles: ["supplier"],
    active: true
  };
}

function createReceivedSupplierInvoice(
  input: CreateSupplierInvoiceInput,
  supplierId: string
): SupplierInvoice {
  return {
    id: createEntityId("sinv"),
    workspaceId: input.workspaceId,
    number: input.number.trim(),
    issueDate: input.issueDate,
    supplierId,
    currency: input.currency,
    total: input.total,
    expenseAccountCode: input.expenseAccountCode ?? "4100",
    status: "received"
  };
}

function createSupplierInvoiceJournalEntry(
  supplierInvoice: SupplierInvoice,
  supplierId: string
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
        partyId: supplierId,
        supplierInvoiceId: supplierInvoice.id
      },
      {
        accountCode: "2200",
        side: "credit",
        amount: supplierInvoice.total,
        currency: supplierInvoice.currency,
        partyId: supplierId,
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
        partyId: supplierInvoice.supplierId,
        supplierInvoiceId: supplierInvoice.id
      },
      {
        accountCode: "1100",
        side: "credit",
        amount: supplierInvoice.total,
        currency: supplierInvoice.currency,
        partyId: supplierInvoice.supplierId,
        supplierInvoiceId: supplierInvoice.id
      }
    ]
  };
}

function createEntityId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function selectSupplierInvoiceInOverview(
  overview: WorkspaceOverview,
  supplierInvoice: SupplierInvoice
): WorkspaceOverview {
  return {
    ...overview,
    latestSupplierInvoice: supplierInvoice,
    latestSupplierInvoiceParty:
      overview.parties.find((party) => party.id === supplierInvoice.supplierId) ??
      null
  };
}
