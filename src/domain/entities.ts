export type IsoDateString = string;
export type IsoDateTimeString = string;
export type MoneyAmount = string;
export type CurrencyCode = string;

export type Workspace = {
  id: string;
  name: string;
  countryCode: string;
  baseCurrency: CurrencyCode;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
};

export type AccountRole = "group" | "posting";

export type Account = {
  id: string;
  workspaceId: string;
  code: string;
  parentCode?: string;
  templateNodeId?: string;
  name: string;
  role: AccountRole;
  currency?: CurrencyCode;
  active: boolean;
};

export type PartyRole =
  | "customer"
  | "supplier"
  | "tax_authority"
  | "bank"
  | "owner";

export type PartyType = "business" | "person" | "government";

export type Party = {
  id: string;
  workspaceId: string;
  name: string;
  countryCode?: string;
  vatId?: string;
  type: PartyType;
  roles: PartyRole[];
  active: boolean;
};

export type InvoiceStatus = "draft" | "issued" | "paid" | "cancelled";

export type Invoice = {
  id: string;
  workspaceId: string;
  number: string;
  issueDate: IsoDateString;
  partyId: string;
  currency: CurrencyCode;
  total: MoneyAmount;
  vatTreatment?: string;
  status: InvoiceStatus;
};

export type SupplierInvoiceStatus = "received" | "approved" | "paid" | "cancelled";

export type SupplierInvoice = {
  id: string;
  workspaceId: string;
  number: string;
  issueDate: IsoDateString;
  partyId: string;
  currency: CurrencyCode;
  total: MoneyAmount;
  expenseAccountCode: string;
  status: SupplierInvoiceStatus;
};

export type BankTransactionStatus = "unmatched" | "matched" | "posted" | "ignored";
export type BankTransactionMatchType = "invoice" | "supplier_invoice" | "bank_fee";

export type BankAccount = {
  id: string;
  workspaceId: string;
  accountCode: string;
  name: string;
  currency: CurrencyCode;
  iban?: string;
  partyId?: string;
  active: boolean;
};

export type BankTransaction = {
  id: string;
  workspaceId: string;
  bankAccountId: string;
  bookingDate: IsoDateString;
  amount: string;
  currency: CurrencyCode;
  description: string;
  reference?: string;
  status: BankTransactionStatus;
  matchedDocumentType?: BankTransactionMatchType;
  matchedDocumentId?: string;
  journalEntryId?: string;
};

export type JournalLineSide = "debit" | "credit";

export type JournalLine = {
  accountCode: string;
  side: JournalLineSide;
  amount: MoneyAmount;
  currency: CurrencyCode;
  partyId?: string;
  invoiceId?: string;
  supplierInvoiceId?: string;
  bankAccountId?: string;
  taxPeriod?: string;
};

export type JournalEntry = {
  id: string;
  workspaceId: string;
  entryDate: IsoDateString;
  sourceType: string;
  sourceId?: string;
  description: string;
  lines: JournalLine[];
};
