import type { BankAccount, BankTransaction, Invoice, JournalEntry, SupplierInvoice } from "../domain";
import { parseMoneyAmount, validateJournalEntry } from "../domain";
import { db, type SpbookDatabase } from "../storage/db";
import {
  getAccountsByWorkspaceId,
  getBankAccountById,
  getBankTransactionById,
  getInvoiceById,
  getSupplierInvoiceById,
  saveBankAccount,
  saveBankTransaction,
  saveBankTransactionPostingData,
  saveInvoicePaymentData,
  saveSupplierInvoicePaymentData
} from "../storage/repositories";
import { loadWorkspaceOverview, type WorkspaceOverview } from "./workspace-overview";

export type CreateBankAccountInput = {
  workspaceId: string;
  name: string;
  accountCode: string;
  currency: string;
  iban?: string;
  partyId?: string;
};

export type CreateBankTransactionInput = {
  workspaceId: string;
  bankAccountId: string;
  bookingDate: string;
  amount: string;
  currency: string;
  description: string;
  reference?: string;
};

export async function createBankAccount(
  input: CreateBankAccountInput,
  database: SpbookDatabase = db
) {
  const accounts = await getAccountsByWorkspaceId(input.workspaceId, database);
  const account = accounts.find((candidate) => candidate.code === input.accountCode);

  if (!account || account.role !== "posting") {
    throw new Error("Bank account must reference an existing posting account.");
  }

  const bankAccount: BankAccount = {
    id: createEntityId("ba"),
    workspaceId: input.workspaceId,
    name: input.name.trim(),
    accountCode: input.accountCode,
    currency: input.currency,
    iban: normalizeOptional(input.iban),
    partyId: normalizeOptional(input.partyId),
    active: true
  };

  if (!bankAccount.name) {
    throw new Error("Bank account name is required.");
  }

  await saveBankAccount(bankAccount, database);

  return loadWorkspaceOverview(input.workspaceId, database);
}

export async function createBankTransaction(
  input: CreateBankTransactionInput,
  database: SpbookDatabase = db
) {
  const bankAccount = await getBankAccountById(input.bankAccountId, database);

  if (!bankAccount) {
    throw new Error(`Bank account "${input.bankAccountId}" was not found.`);
  }

  const amount = parseSignedMoneyAmount(input.amount);

  if (amount === 0n) {
    throw new Error("Bank transaction amount cannot be zero.");
  }

  const bankTransaction: BankTransaction = {
    id: createEntityId("bt"),
    workspaceId: input.workspaceId,
    bankAccountId: input.bankAccountId,
    bookingDate: input.bookingDate,
    amount: formatSignedMinorUnits(amount),
    currency: input.currency,
    description: input.description.trim(),
    reference: normalizeOptional(input.reference),
    status: "unmatched"
  };

  if (!bankTransaction.description) {
    throw new Error("Bank transaction description is required.");
  }

  await saveBankTransaction(bankTransaction, database);

  return loadWorkspaceOverview(input.workspaceId, database);
}

export async function matchInvoicePaymentFromBankTransaction(
  invoiceId: string,
  bankTransactionId: string,
  database: SpbookDatabase = db
) {
  const invoice = await getInvoiceById(invoiceId, database);
  const bankContext = await loadBankTransactionContext(bankTransactionId, database);

  if (!invoice) {
    throw new Error(`Invoice "${invoiceId}" was not found.`);
  }

  ensureUnmatched(bankContext.bankTransaction);
  ensureSignedAmount(bankContext.bankTransaction, "incoming");
  ensureAmountMatches(bankContext.bankTransaction, invoice.total);

  const journalEntry = createInvoicePaymentEntry(invoice, bankContext);
  await validateBankJournalEntry(journalEntry, invoice.workspaceId, database);

  const paidInvoice: Invoice = { ...invoice, status: "paid" };
  const matchedBankTransaction = matchBankTransaction(
    bankContext.bankTransaction,
    "invoice",
    invoice.id,
    journalEntry.id
  );

  await saveInvoicePaymentData(
    {
      invoice: paidInvoice,
      journalEntry,
      bankTransaction: matchedBankTransaction
    },
    database
  );

  return selectInvoiceInOverview(
    await loadWorkspaceOverview(invoice.workspaceId, database),
    paidInvoice
  );
}

export async function matchSupplierPaymentFromBankTransaction(
  supplierInvoiceId: string,
  bankTransactionId: string,
  database: SpbookDatabase = db
) {
  const supplierInvoice = await getSupplierInvoiceById(supplierInvoiceId, database);
  const bankContext = await loadBankTransactionContext(bankTransactionId, database);

  if (!supplierInvoice) {
    throw new Error(`Supplier invoice "${supplierInvoiceId}" was not found.`);
  }

  ensureUnmatched(bankContext.bankTransaction);
  ensureSignedAmount(bankContext.bankTransaction, "outgoing");
  ensureAmountMatches(bankContext.bankTransaction, supplierInvoice.total);

  const journalEntry = createSupplierPaymentEntry(supplierInvoice, bankContext);
  await validateBankJournalEntry(journalEntry, supplierInvoice.workspaceId, database);

  const paidSupplierInvoice: SupplierInvoice = { ...supplierInvoice, status: "paid" };
  const matchedBankTransaction = matchBankTransaction(
    bankContext.bankTransaction,
    "supplier_invoice",
    supplierInvoice.id,
    journalEntry.id
  );

  await saveSupplierInvoicePaymentData(
    {
      supplierInvoice: paidSupplierInvoice,
      journalEntry,
      bankTransaction: matchedBankTransaction
    },
    database
  );

  return selectSupplierInvoiceInOverview(
    await loadWorkspaceOverview(supplierInvoice.workspaceId, database),
    paidSupplierInvoice
  );
}

export async function postBankFeeFromBankTransaction(
  bankTransactionId: string,
  database: SpbookDatabase = db
) {
  const bankContext = await loadBankTransactionContext(bankTransactionId, database);

  ensureUnmatched(bankContext.bankTransaction);
  ensureSignedAmount(bankContext.bankTransaction, "outgoing");

  const journalEntry = createBankFeeEntry(bankContext);
  await validateBankJournalEntry(journalEntry, bankContext.bankTransaction.workspaceId, database);

  const postedBankTransaction = matchBankTransaction(
    bankContext.bankTransaction,
    "bank_fee",
    bankContext.bankTransaction.id,
    journalEntry.id
  );

  await saveBankTransactionPostingData(
    { bankTransaction: postedBankTransaction, journalEntry },
    database
  );

  return loadWorkspaceOverview(bankContext.bankTransaction.workspaceId, database);
}

type BankTransactionContext = {
  bankAccount: BankAccount;
  bankTransaction: BankTransaction;
  amountMinorUnits: bigint;
  absoluteAmount: string;
};

async function loadBankTransactionContext(
  bankTransactionId: string,
  database: SpbookDatabase
): Promise<BankTransactionContext> {
  const bankTransaction = await getBankTransactionById(bankTransactionId, database);

  if (!bankTransaction) {
    throw new Error(`Bank transaction "${bankTransactionId}" was not found.`);
  }

  const bankAccount = await getBankAccountById(bankTransaction.bankAccountId, database);

  if (!bankAccount) {
    throw new Error(`Bank account "${bankTransaction.bankAccountId}" was not found.`);
  }

  const amountMinorUnits = parseSignedMoneyAmount(bankTransaction.amount);

  return {
    bankAccount,
    bankTransaction,
    amountMinorUnits,
    absoluteAmount: formatSignedMinorUnits(
      amountMinorUnits < 0n ? -amountMinorUnits : amountMinorUnits
    )
  };
}

function createInvoicePaymentEntry(
  invoice: Invoice,
  context: BankTransactionContext
): JournalEntry {
  return {
    id: createEntityId("je_bank_invoice_payment"),
    workspaceId: invoice.workspaceId,
    entryDate: context.bankTransaction.bookingDate,
    sourceType: "bank_transaction",
    sourceId: context.bankTransaction.id,
    description: `Bank payment for sales invoice ${invoice.number}`,
    lines: [
      {
        accountCode: context.bankAccount.accountCode,
        side: "debit",
        amount: context.absoluteAmount,
        currency: invoice.currency,
        partyId: invoice.partyId,
        invoiceId: invoice.id,
        bankAccountId: context.bankAccount.id
      },
      {
        accountCode: "1200",
        side: "credit",
        amount: context.absoluteAmount,
        currency: invoice.currency,
        partyId: invoice.partyId,
        invoiceId: invoice.id
      }
    ]
  };
}

function createSupplierPaymentEntry(
  supplierInvoice: SupplierInvoice,
  context: BankTransactionContext
): JournalEntry {
  return {
    id: createEntityId("je_bank_supplier_payment"),
    workspaceId: supplierInvoice.workspaceId,
    entryDate: context.bankTransaction.bookingDate,
    sourceType: "bank_transaction",
    sourceId: context.bankTransaction.id,
    description: `Bank payment for supplier invoice ${supplierInvoice.number}`,
    lines: [
      {
        accountCode: "2200",
        side: "debit",
        amount: context.absoluteAmount,
        currency: supplierInvoice.currency,
        partyId: supplierInvoice.partyId,
        supplierInvoiceId: supplierInvoice.id
      },
      {
        accountCode: context.bankAccount.accountCode,
        side: "credit",
        amount: context.absoluteAmount,
        currency: supplierInvoice.currency,
        partyId: supplierInvoice.partyId,
        supplierInvoiceId: supplierInvoice.id,
        bankAccountId: context.bankAccount.id
      }
    ]
  };
}

function createBankFeeEntry(context: BankTransactionContext): JournalEntry {
  return {
    id: createEntityId("je_bank_fee"),
    workspaceId: context.bankTransaction.workspaceId,
    entryDate: context.bankTransaction.bookingDate,
    sourceType: "bank_transaction",
    sourceId: context.bankTransaction.id,
    description: `Bank fee: ${context.bankTransaction.description}`,
    lines: [
      {
        accountCode: "4100",
        side: "debit",
        amount: context.absoluteAmount,
        currency: context.bankTransaction.currency,
        bankAccountId: context.bankAccount.id
      },
      {
        accountCode: context.bankAccount.accountCode,
        side: "credit",
        amount: context.absoluteAmount,
        currency: context.bankTransaction.currency,
        bankAccountId: context.bankAccount.id
      }
    ]
  };
}

async function validateBankJournalEntry(
  journalEntry: JournalEntry,
  workspaceId: string,
  database: SpbookDatabase
) {
  const validation = validateJournalEntry(
    journalEntry,
    await getAccountsByWorkspaceId(workspaceId, database)
  );

  if (!validation.ok) {
    throw new Error("Bank journal entry is invalid.");
  }
}

function ensureUnmatched(bankTransaction: BankTransaction) {
  if (bankTransaction.status !== "unmatched") {
    throw new Error(`Bank transaction "${bankTransaction.id}" is already processed.`);
  }
}

function ensureSignedAmount(
  bankTransaction: BankTransaction,
  direction: "incoming" | "outgoing"
) {
  const amount = parseSignedMoneyAmount(bankTransaction.amount);

  if (direction === "incoming" && amount <= 0n) {
    throw new Error("Incoming payment requires a positive bank transaction.");
  }

  if (direction === "outgoing" && amount >= 0n) {
    throw new Error("Outgoing payment requires a negative bank transaction.");
  }
}

function ensureAmountMatches(bankTransaction: BankTransaction, amount: string) {
  const transactionAmount = parseSignedMoneyAmount(bankTransaction.amount);
  const expected = parseMoneyAmount(amount);

  if (!expected.ok) {
    throw new Error(`Document amount "${amount}" is invalid.`);
  }

  const absoluteTransactionAmount =
    transactionAmount < 0n ? -transactionAmount : transactionAmount;

  if (absoluteTransactionAmount !== expected.minorUnits) {
    throw new Error("Bank transaction amount must match the document total.");
  }
}

function matchBankTransaction(
  bankTransaction: BankTransaction,
  matchedDocumentType: BankTransaction["matchedDocumentType"],
  matchedDocumentId: string,
  journalEntryId: string
): BankTransaction {
  return {
    ...bankTransaction,
    status: matchedDocumentType === "bank_fee" ? "posted" : "matched",
    matchedDocumentType,
    matchedDocumentId,
    journalEntryId
  };
}

function parseSignedMoneyAmount(amount: string) {
  const sign = amount.trim().startsWith("-") ? -1n : 1n;
  const unsigned = amount.trim().replace(/^-/, "");
  const parsed = parseMoneyAmount(unsigned);

  if (!parsed.ok) {
    throw new Error(`Bank transaction amount "${amount}" is invalid.`);
  }

  return parsed.minorUnits * sign;
}

function formatSignedMinorUnits(minorUnits: bigint) {
  const sign = minorUnits < 0n ? "-" : "";
  const absolute = minorUnits < 0n ? -minorUnits : minorUnits;
  const whole = absolute / 100n;
  const fraction = `${absolute % 100n}`.padStart(2, "0");

  return `${sign}${whole}.${fraction}`;
}

function normalizeOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
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

function selectSupplierInvoiceInOverview(
  overview: WorkspaceOverview,
  supplierInvoice: SupplierInvoice
): WorkspaceOverview {
  return {
    ...overview,
    latestSupplierInvoice: supplierInvoice,
    latestSupplierInvoiceParty:
      overview.parties.find((party) => party.id === supplierInvoice.partyId) ?? null
  };
}
