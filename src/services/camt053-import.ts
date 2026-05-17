import { XMLParser } from "fast-xml-parser";
import type { BankTransaction } from "../domain";
import { db, type SpbookDatabase } from "../storage/db";
import {
  getBankAccountById,
  getBankTransactionsByWorkspaceId,
  getPartiesByWorkspaceId,
  saveBankTransactions
} from "../storage/repositories";
import { loadBankingSlice, loadWorkspaceOverview, type WorkspaceOverview } from "./workspace-overview";

export type Camt053CreditDebitIndicator = "CRDT" | "DBIT";

export type Camt053Entry = {
  entryReference: string;
  accountServicerReference?: string;
  bookingDate: string;
  valueDate?: string;
  amount: string;
  currency: string;
  creditDebitIndicator: Camt053CreditDebitIndicator;
  counterpartyName?: string;
  counterpartyIban?: string;
  reference?: string;
  remittanceInformation?: string;
  description: string;
};

export type Camt053Statement = {
  messageId?: string;
  statementId: string;
  accountIban: string;
  currency: string;
  entries: Camt053Entry[];
};

export type ImportCamt053BankTransactionsResult = {
  bankingSlice: Awaited<ReturnType<typeof loadBankingSlice>>;
  statement: Camt053Statement;
  importedCount: number;
  skippedCount: number;
};

export type AutoLinkImportedBankTransactionsResult = {
  bankingSlice: Awaited<ReturnType<typeof loadBankingSlice>>;
  linkedCount: number;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true
});

export function parseCamt053Statement(xml: string): Camt053Statement {
  const parsed = parser.parse(xml) as unknown;
  const document = asRecord(parsed).Document;
  const bankToCustomerStatement = asRecord(document).BkToCstmrStmt;
  const groupHeader = asRecord(bankToCustomerStatement).GrpHdr;
  const statement = first(asRecord(bankToCustomerStatement).Stmt);

  if (!statement) {
    throw new Error("CAMT.053 statement was not found.");
  }

  const statementRecord = asRecord(statement);
  const account = asRecord(statementRecord.Acct);
  const accountIban = text(asRecord(account.Id).IBAN);
  const currency = text(account.Ccy);
  const entries = asArray(statementRecord.Ntry).map((entry, index) =>
    parseEntry(asRecord(entry), accountIban, currency, index)
  );

  if (!accountIban) {
    throw new Error("CAMT.053 account IBAN was not found.");
  }

  if (!currency) {
    throw new Error("CAMT.053 account currency was not found.");
  }

  return {
    messageId: text(asRecord(groupHeader).MsgId) || undefined,
    statementId: text(statementRecord.Id) || accountIban,
    accountIban,
    currency,
    entries
  };
}

export async function importCamt053BankTransactions(
  input: {
    workspaceId: string;
    bankAccountId: string;
    xml: string;
  },
  database: SpbookDatabase = db
): Promise<ImportCamt053BankTransactionsResult> {
  const bankAccount = await getBankAccountById(input.bankAccountId, database);

  if (!bankAccount) {
    throw new Error(`Bank account "${input.bankAccountId}" was not found.`);
  }

  if (bankAccount.workspaceId !== input.workspaceId) {
    throw new Error("Bank account belongs to another workspace.");
  }

  const statement = parseCamt053Statement(input.xml);
  const normalizedStatementIban = normalizeIban(statement.accountIban);
  const normalizedBankAccountIban = normalizeIban(bankAccount.iban);

  if (
    normalizedBankAccountIban &&
    normalizedStatementIban &&
    normalizedBankAccountIban !== normalizedStatementIban
  ) {
    throw new Error("Statement IBAN does not match the selected bank account.");
  }

  const existingExternalIds = new Set(
    (await getBankTransactionsByWorkspaceId(input.workspaceId, database))
      .map((bankTransaction) => bankTransaction.externalId)
      .filter(Boolean)
  );
  const parties = await getPartiesByWorkspaceId(input.workspaceId, database);

  const bankTransactions = statement.entries
    .map((entry) =>
      toBankTransaction({
        entry,
        workspaceId: input.workspaceId,
        bankAccountId: input.bankAccountId,
        statementAccountIban: statement.accountIban,
        statementId: statement.statementId,
        partyId: findPartyMatch(parties, entry)?.id
      })
    )
    .filter((bankTransaction) => !existingExternalIds.has(bankTransaction.externalId));

  if (bankTransactions.length > 0) {
    await saveBankTransactions(bankTransactions, database);
  }

  return {
    bankingSlice: await loadBankingSlice(input.workspaceId, database),
    statement,
    importedCount: bankTransactions.length,
    skippedCount: statement.entries.length - bankTransactions.length
  };
}

export async function autoLinkImportedBankTransactions(
  workspaceId: string,
  database: SpbookDatabase = db
): Promise<AutoLinkImportedBankTransactionsResult> {
  const [parties, bankTransactions] = await Promise.all([
    getPartiesByWorkspaceId(workspaceId, database),
    getBankTransactionsByWorkspaceId(workspaceId, database)
  ]);
  const linkedBankTransactions = bankTransactions.flatMap((bankTransaction) => {
    if (
      bankTransaction.status !== "unmatched" ||
      !bankTransaction.importSource ||
      bankTransaction.partyId
    ) {
      return [];
    }

    const party = findPartyMatch(parties, {
      counterpartyIban: bankTransaction.counterpartyIban,
      counterpartyName: bankTransaction.counterpartyName
    });

    return party ? [{ ...bankTransaction, partyId: party.id }] : [];
  });

  if (linkedBankTransactions.length > 0) {
    await saveBankTransactions(linkedBankTransactions, database);
  }

  return {
    bankingSlice: await loadBankingSlice(workspaceId, database),
    linkedCount: linkedBankTransactions.length
  };
}

function parseEntry(
  entry: Record<string, unknown>,
  accountIban: string,
  fallbackCurrency: string,
  index: number
): Camt053Entry {
  const entryReference = text(entry.NtryRef) || `entry-${index + 1}`;
  const amountNode = asRecord(entry.Amt);
  const currency = text(amountNode.Ccy) || fallbackCurrency;
  const creditDebitIndicator = parseCreditDebitIndicator(text(entry.CdtDbtInd));
  const entryDetails = first(entry.NtryDtls);
  const transactionDetails = asRecord(first(asRecord(entryDetails).TxDtls));
  const references = asRecord(transactionDetails.Refs);
  const relatedParties = asRecord(transactionDetails.RltdPties);
  const remittance = asRecord(transactionDetails.RmtInf);
  const counterparty = extractCounterparty(relatedParties, creditDebitIndicator, accountIban);
  const remittanceInformation = extractRemittanceInformation(remittance);
  const reference = firstMeaningful([
    extractStructuredReference(remittance),
    text(references.EndToEndId),
    text(references.TxId),
    text(entry.AcctSvcrRef),
    entryReference
  ]);
  const description = firstMeaningful([
    remittanceInformation,
    counterparty.name,
    text(asRecord(transactionDetails.AddtlTxInf)),
    entryReference
  ]) ?? entryReference;

  return {
    entryReference,
    accountServicerReference: text(entry.AcctSvcrRef) || undefined,
    bookingDate: extractDate(entry.BookgDt),
    valueDate: extractDate(entry.ValDt) || undefined,
    amount: formatSignedAmount(text(amountNode["#text"] ?? entry.Amt), creditDebitIndicator),
    currency,
    creditDebitIndicator,
    counterpartyName: counterparty.name,
    counterpartyIban: counterparty.iban,
    reference,
    remittanceInformation,
    description
  };
}

function toBankTransaction(input: {
  entry: Camt053Entry;
  workspaceId: string;
  bankAccountId: string;
  statementAccountIban: string;
  statementId: string;
  partyId?: string;
}): BankTransaction {
  const externalReference =
    input.entry.accountServicerReference || input.entry.entryReference || input.entry.reference;

  return {
    id: createEntityId("bt"),
    workspaceId: input.workspaceId,
    bankAccountId: input.bankAccountId,
    bookingDate: input.entry.bookingDate,
    amount: input.entry.amount,
    currency: input.entry.currency,
    description: input.entry.description,
    reference: input.entry.reference,
    partyId: input.partyId,
    externalId: [
      "camt053",
      normalizeIban(input.statementAccountIban),
      input.statementId,
      externalReference
    ].join(":"),
    importSource: "camt053",
    entryReference: input.entry.entryReference,
    bankReference: input.entry.accountServicerReference,
    valueDate: input.entry.valueDate,
    remittanceInformation: input.entry.remittanceInformation,
    counterpartyName: input.entry.counterpartyName,
    counterpartyIban: input.entry.counterpartyIban,
    status: "unmatched"
  };
}

function findPartyMatch(
  parties: Awaited<ReturnType<typeof getPartiesByWorkspaceId>>,
  entry: Pick<Camt053Entry, "counterpartyIban" | "counterpartyName">
) {
  const normalizedCounterpartyIban = normalizeIban(entry.counterpartyIban);

  if (normalizedCounterpartyIban) {
    const ibanMatch = parties.find(
      (party) => normalizeIban(party.iban) === normalizedCounterpartyIban
    );

    if (ibanMatch) return ibanMatch;
  }

  const normalizedCounterpartyName = normalizeName(entry.counterpartyName);

  if (!normalizedCounterpartyName || normalizedCounterpartyName === "-") {
    return undefined;
  }

  return parties.find((party) => normalizeName(party.name) === normalizedCounterpartyName);
}

function extractCounterparty(
  relatedParties: Record<string, unknown>,
  creditDebitIndicator: Camt053CreditDebitIndicator,
  accountIban: string
) {
  const preferredPartyKey = creditDebitIndicator === "CRDT" ? "Dbtr" : "Cdtr";
  const preferredAccountKey = creditDebitIndicator === "CRDT" ? "DbtrAcct" : "CdtrAcct";
  const fallbackPartyKey = preferredPartyKey === "Dbtr" ? "Cdtr" : "Dbtr";
  const fallbackAccountKey = preferredAccountKey === "DbtrAcct" ? "CdtrAcct" : "DbtrAcct";
  const preferredIban = extractIban(relatedParties[preferredAccountKey]);

  if (normalizeIban(preferredIban) !== normalizeIban(accountIban)) {
    return {
      name: text(asRecord(asRecord(relatedParties[preferredPartyKey]).Pty).Nm) || undefined,
      iban: preferredIban
    };
  }

  return {
    name: text(asRecord(asRecord(relatedParties[fallbackPartyKey]).Pty).Nm) || undefined,
    iban: extractIban(relatedParties[fallbackAccountKey])
  };
}

function extractRemittanceInformation(remittance: Record<string, unknown>) {
  const unstructured = asArray(remittance.Ustrd).map(text).filter(Boolean);
  const structured = asArray(remittance.Strd)
    .flatMap((item) => asArray(asRecord(item).AddtlRmtInf))
    .map(text)
    .filter(Boolean);

  return [...unstructured, ...structured].join(" · ") || undefined;
}

function extractStructuredReference(remittance: Record<string, unknown>) {
  return firstMeaningful(
    asArray(remittance.Strd).map((item) => text(asRecord(asRecord(item).CdtrRefInf).Ref))
  );
}

function extractIban(value: unknown) {
  return text(asRecord(asRecord(value).Id).IBAN) || undefined;
}

function extractDate(value: unknown) {
  return text(asRecord(value).Dt);
}

function parseCreditDebitIndicator(value: string): Camt053CreditDebitIndicator {
  if (value === "CRDT" || value === "DBIT") {
    return value;
  }

  throw new Error(`Unsupported CAMT.053 credit/debit indicator "${value}".`);
}

function formatSignedAmount(
  amount: string,
  creditDebitIndicator: Camt053CreditDebitIndicator
) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount);

  if (!match) {
    throw new Error(`Unsupported CAMT.053 amount "${amount}".`);
  }

  const formatted = `${match[1]}.${(match[2] ?? "").padEnd(2, "0")}`;
  return creditDebitIndicator === "DBIT" ? `-${formatted}` : formatted;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function first(value: unknown) {
  return asArray(value)[0];
}

function text(value: unknown) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  return "";
}

function firstMeaningful(values: Array<string | undefined>) {
  return values.find((value) => value && value !== "NOTPROVIDED");
}

function normalizeIban(value: string | undefined) {
  return value?.replace(/\s+/g, "").toUpperCase() ?? "";
}

function normalizeName(value: string | undefined) {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
}

function createEntityId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}
