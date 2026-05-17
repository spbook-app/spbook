import type {
  BankAccount,
  BankTransaction,
  Invoice,
  JournalEntry,
  SupplierInvoice
} from "../domain";
import { parseMoneyAmount, validateJournalEntry } from "../domain";
import { isValidIban } from "../shared/lib/iban";
import type { Repositories } from "../storage/interfaces";
import { defaultWorkflowStorage, type WorkflowStorage } from "../storage/workflow-persistence";
import {
  loadBankingSlice,
  loadInvoicesSlice,
  loadLedgerSlice,
  loadSupplierInvoicesSlice
} from "./workspace-overview";

export type CreateBankAccountInput = {
  workspaceId: string;
  name: string;
  accountCode: string;
  currency: string;
  iban?: string;
  partyId?: string;
};

export type UpdateBankAccountInput = {
  bankAccountId: string;
  name: string;
  accountCode: string;
  iban?: string;
  partyId?: string;
  active: boolean;
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

export type UpdateBankTransactionInput = {
  bankTransactionId: string;
  bankAccountId: string;
  bookingDate: string;
  amount: string;
  description: string;
  reference?: string;
};

export type LinkBankTransactionPartyInput = {
  bankTransactionId: string;
  partyId?: string;
};

export async function createBankAccount(
  input: CreateBankAccountInput,
  storage: WorkflowStorage = defaultWorkflowStorage
) {
  const repos = storage.repos;
  const accounts = await repos.accounts.getByWorkspaceId(input.workspaceId);
  const account = accounts.find((candidate) => candidate.code === input.accountCode);
  await ensureBankParty(input.workspaceId, input.partyId, repos);

  if (!account || account.role !== "posting") {
    throw new Error("Bank account must reference an existing posting account.");
  }

  await ensureUniqueBankPostingAccount(input.workspaceId, input.accountCode, undefined, repos);

  const bankAccount: BankAccount = {
    id: createEntityId("ba"),
    workspaceId: input.workspaceId,
    name: input.name.trim(),
    accountCode: input.accountCode,
    currency: input.currency,
    iban: normalizeIban(input.iban),
    partyId: normalizeOptional(input.partyId),
    active: true
  };

  if (!bankAccount.name) {
    throw new Error("Bank account name is required.");
  }

  await repos.bankAccounts.save(bankAccount);

  return loadBankingSlice(input.workspaceId, repos);
}

export async function updateBankAccount(
  input: UpdateBankAccountInput,
  storage: WorkflowStorage = defaultWorkflowStorage
) {
  const repos = storage.repos;
  const existingBankAccount = await repos.bankAccounts.getById(input.bankAccountId);

  if (!existingBankAccount) {
    throw new Error(`Bank account "${input.bankAccountId}" was not found.`);
  }

  const accounts = await repos.accounts.getByWorkspaceId(existingBankAccount.workspaceId);
  const account = accounts.find((candidate) => candidate.code === input.accountCode);
  await ensureBankParty(existingBankAccount.workspaceId, input.partyId, repos);

  if (!account || account.role !== "posting") {
    throw new Error("Bank account must reference an existing posting account.");
  }

  if (input.active) {
    await ensureUniqueBankPostingAccount(
      existingBankAccount.workspaceId,
      input.accountCode,
      existingBankAccount.id,
      repos
    );
  }

  const updatedBankAccount: BankAccount = {
    ...existingBankAccount,
    name: input.name.trim(),
    accountCode: input.accountCode,
    iban: normalizeIban(input.iban),
    partyId: normalizeOptional(input.partyId),
    active: input.active
  };

  if (!updatedBankAccount.name) {
    throw new Error("Bank account name is required.");
  }

  await repos.bankAccounts.save(updatedBankAccount);

  return loadBankingSlice(existingBankAccount.workspaceId, repos);
}

export async function createBankTransaction(
  input: CreateBankTransactionInput,
  storage: WorkflowStorage = defaultWorkflowStorage
) {
  const repos = storage.repos;
  const bankAccount = await repos.bankAccounts.getById(input.bankAccountId);

  if (!bankAccount) {
    throw new Error(`Bank account "${input.bankAccountId}" was not found.`);
  }

  ensureBankAccountWorkspace(bankAccount, input.workspaceId);
  const amount = parseBankTransactionAmount(input.amount);

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

  ensureBankTransactionFields(bankTransaction.bookingDate, bankTransaction.description);

  await repos.bankTransactions.save(bankTransaction);

  return loadBankingSlice(input.workspaceId, repos);
}

export async function updateBankTransaction(
  input: UpdateBankTransactionInput,
  storage: WorkflowStorage = defaultWorkflowStorage
) {
  const repos = storage.repos;
  const existingBankTransaction = await repos.bankTransactions.getById(
    input.bankTransactionId
  );

  if (!existingBankTransaction) {
    throw new Error(`Bank transaction "${input.bankTransactionId}" was not found.`);
  }

  ensureUnmatched(existingBankTransaction);
  ensureManualBankTransaction(existingBankTransaction);

  const bankAccount = await repos.bankAccounts.getById(input.bankAccountId);

  if (!bankAccount) {
    throw new Error(`Bank account "${input.bankAccountId}" was not found.`);
  }

  ensureBankAccountWorkspace(bankAccount, existingBankTransaction.workspaceId);
  const amount = parseBankTransactionAmount(input.amount);
  const updatedBankTransaction: BankTransaction = {
    ...existingBankTransaction,
    bankAccountId: input.bankAccountId,
    bookingDate: input.bookingDate,
    amount: formatSignedMinorUnits(amount),
    description: input.description.trim(),
    reference: normalizeOptional(input.reference)
  };

  ensureBankTransactionFields(
    updatedBankTransaction.bookingDate,
    updatedBankTransaction.description
  );

  await repos.bankTransactions.save(updatedBankTransaction);

  return loadBankingSlice(existingBankTransaction.workspaceId, repos);
}

export async function linkBankTransactionParty(
  input: LinkBankTransactionPartyInput,
  storage: WorkflowStorage = defaultWorkflowStorage
) {
  const repos = storage.repos;
  const existingBankTransaction = await repos.bankTransactions.getById(
    input.bankTransactionId
  );

  if (!existingBankTransaction) {
    throw new Error(`Bank transaction "${input.bankTransactionId}" was not found.`);
  }

  ensureUnmatched(existingBankTransaction);
  const partyId = normalizeOptional(input.partyId);

  if (partyId) {
    const party = await repos.parties.getById(partyId);

    if (!party || party.workspaceId !== existingBankTransaction.workspaceId) {
      throw new Error(`Party "${partyId}" was not found.`);
    }
  }

  await repos.bankTransactions.save(
    {
      ...existingBankTransaction,
      partyId
    }
  );

  return loadBankingSlice(existingBankTransaction.workspaceId, repos);
}

async function ensureUniqueBankPostingAccount(
  workspaceId: string,
  accountCode: string,
  ignoredBankAccountId: string | undefined,
  repos: Repositories
) {
  const bankAccounts = await repos.bankAccounts.getByWorkspaceId(workspaceId);
  const duplicate = bankAccounts.find(
    (bankAccount) =>
      bankAccount.active &&
      bankAccount.accountCode === accountCode &&
      bankAccount.id !== ignoredBankAccountId
  );

  if (duplicate) {
    throw new Error("A bank account already uses this posting account.");
  }
}

async function ensureBankParty(
  workspaceId: string,
  partyId: string | undefined,
  repos: Repositories
) {
  const normalizedPartyId = normalizeOptional(partyId);

  if (!normalizedPartyId) return;

  const party = await repos.parties.getById(normalizedPartyId);

  if (!party || party.workspaceId !== workspaceId) {
    throw new Error(`Bank party "${normalizedPartyId}" was not found.`);
  }

  if (!party.roles.includes("bank")) {
    throw new Error("Bank account party must have the bank role.");
  }
}

export async function matchInvoicePaymentFromBankTransaction(
  invoiceId: string,
  bankTransactionId: string,
  storage: WorkflowStorage = defaultWorkflowStorage
) {
  const repos = storage.repos;
  const invoice = await repos.invoices.getById(invoiceId);
  const bankContext = await loadBankTransactionContext(bankTransactionId, repos);

  if (!invoice) {
    throw new Error(`Invoice "${invoiceId}" was not found.`);
  }

  ensureUnmatched(bankContext.bankTransaction);
  ensureSignedAmount(bankContext.bankTransaction, "incoming");
  ensureAmountMatches(bankContext.bankTransaction, invoice.total);

  const journalEntry = createInvoicePaymentEntry(invoice, bankContext);
  await validateBankJournalEntry(journalEntry, invoice.workspaceId, repos);

  const paidInvoice: Invoice = { ...invoice, status: "paid" };
  const matchedBankTransaction = matchBankTransaction(
    bankContext.bankTransaction,
    "invoice",
    invoice.id,
    journalEntry.id
  );

  await storage.persistence.saveInvoicePaymentData({
    invoice: paidInvoice,
    journalEntry,
    bankTransaction: matchedBankTransaction
  });

  const [bankingSlice, invoicesSlice, ledgerSlice] = await Promise.all([
    loadBankingSlice(invoice.workspaceId, repos),
    loadInvoicesSlice(invoice.workspaceId, paidInvoice, repos),
    loadLedgerSlice(invoice.workspaceId, repos)
  ]);
  return { ...bankingSlice, ...invoicesSlice, ...ledgerSlice };
}

export async function matchSupplierPaymentFromBankTransaction(
  supplierInvoiceId: string,
  bankTransactionId: string,
  storage: WorkflowStorage = defaultWorkflowStorage
) {
  const repos = storage.repos;
  const supplierInvoice = await repos.supplierInvoices.getById(supplierInvoiceId);
  const bankContext = await loadBankTransactionContext(bankTransactionId, repos);

  if (!supplierInvoice) {
    throw new Error(`Supplier invoice "${supplierInvoiceId}" was not found.`);
  }

  ensureUnmatched(bankContext.bankTransaction);
  ensureSignedAmount(bankContext.bankTransaction, "outgoing");
  ensureAmountMatches(bankContext.bankTransaction, supplierInvoice.total);

  const journalEntry = createSupplierPaymentEntry(supplierInvoice, bankContext);
  await validateBankJournalEntry(journalEntry, supplierInvoice.workspaceId, repos);

  const paidSupplierInvoice: SupplierInvoice = { ...supplierInvoice, status: "paid" };
  const matchedBankTransaction = matchBankTransaction(
    bankContext.bankTransaction,
    "supplier_invoice",
    supplierInvoice.id,
    journalEntry.id
  );

  await storage.persistence.saveSupplierInvoicePaymentData({
    supplierInvoice: paidSupplierInvoice,
    journalEntry,
    bankTransaction: matchedBankTransaction
  });

  const [bankingSlice, supplierInvoicesSlice, ledgerSlice] = await Promise.all([
    loadBankingSlice(supplierInvoice.workspaceId, repos),
    loadSupplierInvoicesSlice(supplierInvoice.workspaceId, paidSupplierInvoice, repos),
    loadLedgerSlice(supplierInvoice.workspaceId, repos)
  ]);
  return { ...bankingSlice, ...supplierInvoicesSlice, ...ledgerSlice };
}

export async function postBankFeeFromBankTransaction(
  bankTransactionId: string,
  storage: WorkflowStorage = defaultWorkflowStorage
) {
  const repos = storage.repos;
  const bankContext = await loadBankTransactionContext(bankTransactionId, repos);

  ensureUnmatched(bankContext.bankTransaction);
  ensureSignedAmount(bankContext.bankTransaction, "outgoing");

  const journalEntry = createBankFeeEntry(bankContext);
  await validateBankJournalEntry(journalEntry, bankContext.bankTransaction.workspaceId, repos);

  const postedBankTransaction = matchBankTransaction(
    bankContext.bankTransaction,
    "bank_fee",
    bankContext.bankTransaction.id,
    journalEntry.id
  );

  await storage.persistence.saveBankTransactionPostingData(
    { bankTransaction: postedBankTransaction, journalEntry }
  );

  const [bankingSlice, ledgerSlice] = await Promise.all([
    loadBankingSlice(bankContext.bankTransaction.workspaceId, repos),
    loadLedgerSlice(bankContext.bankTransaction.workspaceId, repos)
  ]);
  return { ...bankingSlice, ...ledgerSlice };
}

export async function undoBankTransactionPosting(
  bankTransactionId: string,
  storage: WorkflowStorage = defaultWorkflowStorage
) {
  const repos = storage.repos;
  const bankTransaction = await repos.bankTransactions.getById(bankTransactionId);

  if (!bankTransaction) {
    throw new Error(`Bank transaction "${bankTransactionId}" was not found.`);
  }

  if (bankTransaction.status === "unmatched") {
    throw new Error("Bank transaction is not posted or matched.");
  }

  if (!bankTransaction.journalEntryId) {
    throw new Error("Bank transaction has no linked journal entry.");
  }

  const journalEntry = await repos.journalEntries.getById(bankTransaction.journalEntryId);

  if (!journalEntry) {
    throw new Error(`Journal entry "${bankTransaction.journalEntryId}" was not found.`);
  }

  const unmatchedBankTransaction: BankTransaction = {
    ...bankTransaction,
    status: "unmatched",
    matchedDocumentType: undefined,
    matchedDocumentId: undefined,
    journalEntryId: undefined
  };
  const invoice =
    bankTransaction.matchedDocumentType === "invoice" && bankTransaction.matchedDocumentId
      ? await repos.invoices.getById(bankTransaction.matchedDocumentId)
      : undefined;
  const supplierInvoice =
    bankTransaction.matchedDocumentType === "supplier_invoice" &&
    bankTransaction.matchedDocumentId
      ? await repos.supplierInvoices.getById(bankTransaction.matchedDocumentId)
      : undefined;

  await storage.persistence.undoBankTransactionPostingData({
    bankTransaction: unmatchedBankTransaction,
    invoice: invoice ? { ...invoice, status: "issued" } : undefined,
    supplierInvoice: supplierInvoice
      ? { ...supplierInvoice, status: "approved" }
      : undefined,
    journalEntryId: journalEntry.id
  });

  const [bankingSlice, invoicesSlice, supplierInvoicesSlice, ledgerSlice] = await Promise.all([
    loadBankingSlice(bankTransaction.workspaceId, repos),
    loadInvoicesSlice(bankTransaction.workspaceId, undefined, repos),
    loadSupplierInvoicesSlice(bankTransaction.workspaceId, undefined, repos),
    loadLedgerSlice(bankTransaction.workspaceId, repos)
  ]);
  return { ...bankingSlice, ...invoicesSlice, ...supplierInvoicesSlice, ...ledgerSlice };
}

type BankTransactionContext = {
  bankAccount: BankAccount;
  bankTransaction: BankTransaction;
  amountMinorUnits: bigint;
  absoluteAmount: string;
};

async function loadBankTransactionContext(
  bankTransactionId: string,
  repos: Repositories
): Promise<BankTransactionContext> {
  const bankTransaction = await repos.bankTransactions.getById(bankTransactionId);

  if (!bankTransaction) {
    throw new Error(`Bank transaction "${bankTransactionId}" was not found.`);
  }

  const bankAccount = await repos.bankAccounts.getById(bankTransaction.bankAccountId);

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
  const partyId = context.bankTransaction.partyId ?? context.bankAccount.partyId;

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
        partyId,
        bankAccountId: context.bankAccount.id
      },
      {
        accountCode: context.bankAccount.accountCode,
        side: "credit",
        amount: context.absoluteAmount,
        currency: context.bankTransaction.currency,
        partyId,
        bankAccountId: context.bankAccount.id
      }
    ]
  };
}

async function validateBankJournalEntry(
  journalEntry: JournalEntry,
  workspaceId: string,
  repos: Repositories
) {
  const validation = validateJournalEntry(
    journalEntry,
    await repos.accounts.getByWorkspaceId(workspaceId)
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

function ensureManualBankTransaction(bankTransaction: BankTransaction) {
  if (bankTransaction.importSource) {
    throw new Error("Imported bank statement entries cannot be edited.");
  }
}

function ensureBankAccountWorkspace(bankAccount: BankAccount, workspaceId: string) {
  if (bankAccount.workspaceId !== workspaceId) {
    throw new Error("Bank account belongs to another workspace.");
  }
}

function ensureBankTransactionFields(bookingDate: string, description: string) {
  if (!bookingDate) {
    throw new Error("Bank transaction booking date is required.");
  }

  if (!description) {
    throw new Error("Bank transaction description is required.");
  }
}

function parseBankTransactionAmount(amount: string) {
  const parsedAmount = parseSignedMoneyAmount(amount);

  if (parsedAmount === 0n) {
    throw new Error("Bank transaction amount cannot be zero.");
  }

  return parsedAmount;
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

function normalizeIban(value: string | undefined) {
  const normalized = value?.replace(/\s+/g, "").toUpperCase();

  if (!normalized) {
    return undefined;
  }

  if (!isValidIban(normalized)) {
    throw new Error("IBAN is invalid.");
  }

  return normalized;
}



function createEntityId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}
