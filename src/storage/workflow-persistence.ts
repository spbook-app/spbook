import type { BankTransaction, Invoice, JournalEntry, Party, SupplierInvoice } from "../domain";
import { db, type SpbookDatabase } from "./db";
import type { Repositories } from "./interfaces";
import { createRepositories } from "./repositories";
import {
  deleteInvoiceWorkflowData,
  deleteSupplierInvoiceWorkflowData,
  revertInvoiceToDraft,
  saveBankTransactionPostingData,
  saveInvoiceJournalEntryData,
  saveInvoicePaymentData,
  saveInvoiceWorkflowData,
  savePartyJournalEntryData,
  saveSupplierInvoiceJournalEntryData,
  saveSupplierInvoicePaymentData,
  saveSupplierInvoiceWorkflowData,
  undoBankTransactionPostingData
} from "./repositories";

export interface WorkflowPersistence {
  saveInvoiceWorkflowData(data: {
    party: Party;
    invoice: Invoice;
    journalEntry: JournalEntry;
  }): Promise<void>;

  saveInvoiceJournalEntryData(data: {
    invoice: Invoice;
    journalEntry: JournalEntry;
  }): Promise<void>;

  deleteInvoiceWorkflowData(data: {
    invoiceId: string;
    journalEntryIds: string[];
  }): Promise<void>;

  revertInvoiceToDraft(data: {
    invoice: Invoice;
    journalEntryId: string;
  }): Promise<void>;

  saveInvoicePaymentData(data: {
    invoice: Invoice;
    journalEntry: JournalEntry;
    bankTransaction?: BankTransaction;
  }): Promise<void>;

  saveSupplierInvoiceWorkflowData(data: {
    supplier: Party;
    supplierInvoice: SupplierInvoice;
    journalEntry: JournalEntry;
  }): Promise<void>;

  saveSupplierInvoiceJournalEntryData(data: {
    supplierInvoice: SupplierInvoice;
    journalEntry: JournalEntry;
  }): Promise<void>;

  deleteSupplierInvoiceWorkflowData(data: {
    supplierInvoiceId: string;
    journalEntryIds: string[];
  }): Promise<void>;

  saveSupplierInvoicePaymentData(data: {
    supplierInvoice: SupplierInvoice;
    journalEntry: JournalEntry;
    bankTransaction?: BankTransaction;
  }): Promise<void>;

  saveBankTransactionPostingData(data: {
    bankTransaction: BankTransaction;
    journalEntry: JournalEntry;
  }): Promise<void>;

  undoBankTransactionPostingData(data: {
    bankTransaction: BankTransaction;
    invoice?: Invoice;
    supplierInvoice?: SupplierInvoice;
    journalEntryId: string;
  }): Promise<void>;

  savePartyJournalEntryData(data: {
    party: Party;
    journalEntry: JournalEntry;
  }): Promise<void>;
}

export interface WorkflowStorage {
  repos: Repositories;
  persistence: WorkflowPersistence;
}

export function createWorkflowPersistence(database: SpbookDatabase = db): WorkflowPersistence {
  return {
    saveInvoiceWorkflowData: (data) => saveInvoiceWorkflowData(data, database),
    saveInvoiceJournalEntryData: (data) => saveInvoiceJournalEntryData(data, database),
    deleteInvoiceWorkflowData: (data) => deleteInvoiceWorkflowData(data, database),
    revertInvoiceToDraft: (data) => revertInvoiceToDraft(data, database),
    saveInvoicePaymentData: (data) => saveInvoicePaymentData(data, database),
    saveSupplierInvoiceWorkflowData: (data) => saveSupplierInvoiceWorkflowData(data, database),
    saveSupplierInvoiceJournalEntryData: (data) => saveSupplierInvoiceJournalEntryData(data, database),
    deleteSupplierInvoiceWorkflowData: (data) => deleteSupplierInvoiceWorkflowData(data, database),
    saveSupplierInvoicePaymentData: (data) => saveSupplierInvoicePaymentData(data, database),
    saveBankTransactionPostingData: (data) => saveBankTransactionPostingData(data, database),
    undoBankTransactionPostingData: (data) => undoBankTransactionPostingData(data, database),
    savePartyJournalEntryData: (data) => savePartyJournalEntryData(data, database),
  };
}

export function createWorkflowStorage(database: SpbookDatabase = db): WorkflowStorage {
  return {
    repos: createRepositories(database),
    persistence: createWorkflowPersistence(database),
  };
}

export const defaultWorkflowStorage: WorkflowStorage = createWorkflowStorage(db);
