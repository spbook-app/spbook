import { beforeEach, describe, expect, it } from "vitest";
import type { BankTransaction } from "../domain";
import { createDatabase, type SpbookDatabase } from "../storage/db";
import { initializeDefaultWorkspace } from "../storage/initialize-workspace";
import { saveBankTransaction } from "../storage/repositories";
import {
  createBankAccount,
  createBankTransaction,
  linkBankTransactionParty,
  matchInvoicePaymentFromBankTransaction,
  matchSupplierPaymentFromBankTransaction,
  postBankFeeFromBankTransaction,
  undoBankTransactionPosting,
  updateBankAccount,
  updateBankTransaction
} from "./bank-workflow";
import { createWorkspaceAccount } from "./account-workflow";
import { createSalesInvoice } from "./invoice-workflow";
import { createParty } from "./party-workflow";
import { createSupplierInvoice } from "./supplier-invoice-workflow";

describe("bank workflow", () => {
  let database: SpbookDatabase;

  beforeEach(() => {
    database = createDatabase(`spbook_bank_workflow_test_${crypto.randomUUID()}`);
  });

  it("creates bank accounts and bank transactions", async () => {
    const initialization = await initializeDefaultWorkspace(database);
    const partyOverview = await createParty(
      {
        workspaceId: initialization.workspace.id,
        name: "NLB d.d.",
        type: "business",
        roles: ["bank"],
        countryCode: "SI"
      },
      database
    );
    const accountOverview = await createBankAccount(
      {
        workspaceId: initialization.workspace.id,
        name: "NLB EUR",
        accountCode: "1100",
        currency: "EUR",
        iban: "SI56 1910 0000 0123 438",
        partyId: partyOverview.parties[0]!.id
      },
      database
    );
    const transactionOverview = await createBankTransaction(
      {
        workspaceId: initialization.workspace.id,
        bankAccountId: accountOverview.bankAccounts[0]!.id,
        bookingDate: "2026-05-15",
        amount: "1000.00",
        currency: "EUR",
        description: "Customer payment"
      },
      database
    );

    expect(transactionOverview.bankAccounts).toHaveLength(1);
    expect(transactionOverview.bankTransactions).toHaveLength(1);
    expect(transactionOverview.bankTransactions[0]).toMatchObject({
      amount: "1000.00",
      status: "unmatched"
    });
    expect(transactionOverview.bankAccounts[0]?.iban).toBe("SI56191000000123438");
    expect(transactionOverview.bankAccounts[0]?.partyId).toBe(partyOverview.parties[0]!.id);
  });

  it("rejects bank account parties without the bank role", async () => {
    const initialization = await initializeDefaultWorkspace(database);
    const partyOverview = await createParty(
      {
        workspaceId: initialization.workspace.id,
        name: "ACME d.o.o.",
        type: "business",
        roles: ["customer"]
      },
      database
    );

    await expect(
      createBankAccount(
        {
          workspaceId: initialization.workspace.id,
          name: "NLB EUR",
          accountCode: "1100",
          currency: "EUR",
          partyId: partyOverview.parties[0]!.id
        },
        database
      )
    ).rejects.toThrow("Bank account party must have the bank role.");
  });

  it("updates bank account parameters", async () => {
    const initialization = await initializeDefaultWorkspace(database);
    await createWorkspaceAccount(
      {
        workspaceId: initialization.workspace.id,
        code: "1101",
        name: "Second bank account",
        role: "posting",
        parentCode: "11",
        currency: "EUR"
      },
      database
    );
    const accountOverview = await createBankAccount(
      {
        workspaceId: initialization.workspace.id,
        name: "NLB EUR",
        accountCode: "1100",
        currency: "EUR",
        iban: "SI56 1910 0000 0123 438"
      },
      database
    );
    const updatedOverview = await updateBankAccount(
      {
        bankAccountId: accountOverview.bankAccounts[0]!.id,
        name: "NLB Main EUR",
        accountCode: "1101",
        iban: "SI56 1910 0000 0123 438",
        active: true
      },
      database
    );

    expect(updatedOverview.bankAccounts[0]).toMatchObject({
      name: "NLB Main EUR",
      accountCode: "1101",
      iban: "SI56191000000123438",
      active: true
    });
  });

  it("rejects invalid IBAN values", async () => {
    const initialization = await initializeDefaultWorkspace(database);

    await expect(
      createBankAccount(
        {
          workspaceId: initialization.workspace.id,
          name: "NLB EUR",
          accountCode: "1100",
          currency: "EUR",
          iban: "SI56000000000000000"
        },
        database
      )
    ).rejects.toThrow("IBAN is invalid.");
  });

  it("rejects multiple active bank accounts for the same posting account", async () => {
    const initialization = await initializeDefaultWorkspace(database);
    await createBankAccount(
      {
        workspaceId: initialization.workspace.id,
        name: "NLB EUR",
        accountCode: "1100",
        currency: "EUR"
      },
      database
    );

    await expect(
      createBankAccount(
        {
          workspaceId: initialization.workspace.id,
          name: "Another EUR",
          accountCode: "1100",
          currency: "EUR"
        },
        database
      )
    ).rejects.toThrow("A bank account already uses this posting account.");
  });

  it("updates unmatched bank transactions", async () => {
    const initialization = await initializeDefaultWorkspace(database);
    const accountOverview = await createBankAccount(
      {
        workspaceId: initialization.workspace.id,
        name: "NLB EUR",
        accountCode: "1100",
        currency: "EUR"
      },
      database
    );
    const transactionOverview = await createBankTransaction(
      {
        workspaceId: initialization.workspace.id,
        bankAccountId: accountOverview.bankAccounts[0]!.id,
        bookingDate: "2026-05-15",
        amount: "1000.00",
        currency: "EUR",
        description: "Customer payment"
      },
      database
    );
    const updatedOverview = await updateBankTransaction(
      {
        bankTransactionId: transactionOverview.bankTransactions[0]!.id,
        bankAccountId: accountOverview.bankAccounts[0]!.id,
        bookingDate: "2026-05-16",
        amount: "999.50",
        description: "Updated customer payment",
        reference: "INV-2026-0001"
      },
      database
    );

    expect(updatedOverview.bankTransactions[0]).toMatchObject({
      bookingDate: "2026-05-16",
      amount: "999.50",
      description: "Updated customer payment",
      reference: "INV-2026-0001",
      status: "unmatched"
    });
  });

  it("rejects editing processed bank transactions", async () => {
    const context = await createSalesContext("1000.00");
    const matchedOverview = await matchInvoicePaymentFromBankTransaction(
      context.invoiceId,
      context.bankTransactionId,
      database
    );

    await expect(
      updateBankTransaction(
        {
          bankTransactionId: context.bankTransactionId,
          bankAccountId: matchedOverview.bankAccounts[0]!.id,
          bookingDate: "2026-05-17",
          amount: "999.50",
          description: "Updated payment"
        },
        database
      )
    ).rejects.toThrow(`Bank transaction "${context.bankTransactionId}" is already processed.`);
  });

  it("rejects editing imported bank transactions", async () => {
    const initialization = await initializeDefaultWorkspace(database);
    const accountOverview = await createBankAccount(
      {
        workspaceId: initialization.workspace.id,
        name: "NLB EUR",
        accountCode: "1100",
        currency: "EUR"
      },
      database
    );
    const importedBankTransaction: BankTransaction = {
      id: `bt_${crypto.randomUUID()}`,
      workspaceId: initialization.workspace.id,
      bankAccountId: accountOverview.bankAccounts[0]!.id,
      bookingDate: "2026-05-15",
      amount: "1000.00",
      currency: "EUR",
      description: "Imported payment",
      externalId: "camt053:statement:entry",
      importSource: "camt053",
      status: "unmatched"
    };
    await saveBankTransaction(importedBankTransaction, database);

    await expect(
      updateBankTransaction(
        {
          bankTransactionId: importedBankTransaction.id,
          bankAccountId: accountOverview.bankAccounts[0]!.id,
          bookingDate: "2026-05-16",
          amount: "999.50",
          description: "Updated imported payment"
        },
        database
      )
    ).rejects.toThrow("Imported bank statement entries cannot be edited.");
  });

  it("links an unmatched imported bank transaction to a counterparty", async () => {
    const initialization = await initializeDefaultWorkspace(database);
    const accountOverview = await createBankAccount(
      {
        workspaceId: initialization.workspace.id,
        name: "NLB EUR",
        accountCode: "1100",
        currency: "EUR"
      },
      database
    );
    const partyOverview = await createParty(
      {
        workspaceId: initialization.workspace.id,
        name: "ACME d.o.o.",
        type: "business",
        roles: ["customer"],
        iban: "SI56 1910 0000 0123 438"
      },
      database
    );
    const importedBankTransaction: BankTransaction = {
      id: `bt_${crypto.randomUUID()}`,
      workspaceId: initialization.workspace.id,
      bankAccountId: accountOverview.bankAccounts[0]!.id,
      bookingDate: "2026-05-15",
      amount: "1000.00",
      currency: "EUR",
      description: "Imported payment",
      externalId: "camt053:statement:entry",
      importSource: "camt053",
      status: "unmatched"
    };
    await saveBankTransaction(importedBankTransaction, database);

    const overview = await linkBankTransactionParty(
      {
        bankTransactionId: importedBankTransaction.id,
        partyId: partyOverview.parties[0]!.id
      },
      database
    );

    expect(overview.bankTransactions[0]).toMatchObject({
      id: importedBankTransaction.id,
      partyId: partyOverview.parties[0]!.id
    });
  });

  it("matches an incoming bank transaction to an issued invoice", async () => {
    const context = await createSalesContext("1000.00");
    const matchedOverview = await matchInvoicePaymentFromBankTransaction(
      context.invoiceId,
      context.bankTransactionId,
      database
    );

    expect(matchedOverview.invoice?.status).toBe("paid");
    expect(matchedOverview.bankTransactions[0]?.status).toBe("matched");
    expect(matchedOverview.bankTransactions[0]?.matchedDocumentType).toBe("invoice");
    expect(matchedOverview.journalEntries).toHaveLength(2);
    expect(matchedOverview.journalEntries[1]?.sourceType).toBe("bank_transaction");
    expect(balanceFor(matchedOverview.balances, "1100")).toBe("1000.00");
    expect(balanceFor(matchedOverview.balances, "1200")).toBe("0.00");
  });

  it("undoes an invoice payment match", async () => {
    const context = await createSalesContext("1000.00");
    await matchInvoicePaymentFromBankTransaction(
      context.invoiceId,
      context.bankTransactionId,
      database
    );
    const undoneOverview = await undoBankTransactionPosting(
      context.bankTransactionId,
      database
    );

    expect(undoneOverview.invoice?.status).toBe("issued");
    expect(undoneOverview.bankTransactions[0]).toMatchObject({
      status: "unmatched",
      matchedDocumentType: undefined,
      matchedDocumentId: undefined,
      journalEntryId: undefined
    });
    expect(undoneOverview.journalEntries).toHaveLength(1);
  });

  it("matches an outgoing bank transaction to a supplier invoice", async () => {
    const context = await createSupplierContext("40.00");
    const matchedOverview = await matchSupplierPaymentFromBankTransaction(
      context.supplierInvoiceId,
      context.bankTransactionId,
      database
    );

    expect(matchedOverview.supplierInvoice?.status).toBe("paid");
    expect(matchedOverview.bankTransactions[0]?.status).toBe("matched");
    expect(matchedOverview.bankTransactions[0]?.matchedDocumentType).toBe(
      "supplier_invoice"
    );
    expect(balanceFor(matchedOverview.balances, "1100")).toBe("-40.00");
    expect(balanceFor(matchedOverview.balances, "2200")).toBe("0.00");
  });

  it("posts an outgoing bank transaction as a bank fee", async () => {
    const initialization = await initializeDefaultWorkspace(database);
    const accountOverview = await createBankAccount(
      {
        workspaceId: initialization.workspace.id,
        name: "NLB EUR",
        accountCode: "1100",
        currency: "EUR"
      },
      database
    );
    const transactionOverview = await createBankTransaction(
      {
        workspaceId: initialization.workspace.id,
        bankAccountId: accountOverview.bankAccounts[0]!.id,
        bookingDate: "2026-05-15",
        amount: "-3.50",
        currency: "EUR",
        description: "Monthly bank fee"
      },
      database
    );
    const postedOverview = await postBankFeeFromBankTransaction(
      transactionOverview.bankTransactions[0]!.id,
      database
    );

    expect(postedOverview.bankTransactions[0]?.status).toBe("posted");
    expect(postedOverview.bankTransactions[0]?.matchedDocumentType).toBe("bank_fee");
    expect(balanceFor(postedOverview.balances, "1100")).toBe("-3.50");
    expect(balanceFor(postedOverview.balances, "4100")).toBe("3.50");
  });

  it("undoes a bank fee posting", async () => {
    const initialization = await initializeDefaultWorkspace(database);
    const accountOverview = await createBankAccount(
      {
        workspaceId: initialization.workspace.id,
        name: "NLB EUR",
        accountCode: "1100",
        currency: "EUR"
      },
      database
    );
    const transactionOverview = await createBankTransaction(
      {
        workspaceId: initialization.workspace.id,
        bankAccountId: accountOverview.bankAccounts[0]!.id,
        bookingDate: "2026-05-15",
        amount: "-3.50",
        currency: "EUR",
        description: "Monthly bank fee"
      },
      database
    );
    const postedOverview = await postBankFeeFromBankTransaction(
      transactionOverview.bankTransactions[0]!.id,
      database
    );
    const undoneOverview = await undoBankTransactionPosting(
      transactionOverview.bankTransactions[0]!.id,
      database
    );

    expect(postedOverview.journalEntries).toHaveLength(1);
    expect(undoneOverview.bankTransactions[0]).toMatchObject({
      status: "unmatched",
      matchedDocumentType: undefined,
      journalEntryId: undefined
    });
    expect(undoneOverview.journalEntries).toHaveLength(0);
  });

  async function createSalesContext(total: string) {
    const initialization = await initializeDefaultWorkspace(database);
    const partyOverview = await createParty(
      {
        workspaceId: initialization.workspace.id,
        name: "ACME d.o.o.",
        type: "business",
        roles: ["customer"]
      },
      database
    );
    const accountOverview = await createBankAccount(
      {
        workspaceId: initialization.workspace.id,
        name: "NLB EUR",
        accountCode: "1100",
        currency: "EUR"
      },
      database
    );
    const invoiceOverview = await createSalesInvoice(
      {
        workspaceId: initialization.workspace.id,
        partyId: partyOverview.parties[0]!.id,
        number: "2026-0001",
        issueDate: "2026-05-15",
        total,
        currency: "EUR"
      },
      database
    );
    const transactionOverview = await createBankTransaction(
      {
        workspaceId: initialization.workspace.id,
        bankAccountId: accountOverview.bankAccounts[0]!.id,
        bookingDate: "2026-05-16",
        amount: total,
        currency: "EUR",
        description: "Customer payment"
      },
      database
    );

    return {
      invoiceId: invoiceOverview.invoice!.id,
      bankTransactionId: transactionOverview.bankTransactions![0]!.id
    };
  }

  async function createSupplierContext(total: string) {
    const initialization = await initializeDefaultWorkspace(database);
    const partyOverview = await createParty(
      {
        workspaceId: initialization.workspace.id,
        name: "Supplier d.o.o.",
        type: "business",
        roles: ["supplier"]
      },
      database
    );
    const accountOverview = await createBankAccount(
      {
        workspaceId: initialization.workspace.id,
        name: "NLB EUR",
        accountCode: "1100",
        currency: "EUR"
      },
      database
    );
    const supplierInvoiceOverview = await createSupplierInvoice(
      {
        workspaceId: initialization.workspace.id,
        partyId: partyOverview.parties![0]!.id,
        number: "SUP-2026-0001",
        issueDate: "2026-05-15",
        total,
        currency: "EUR"
      },
      database
    );
    const transactionOverview = await createBankTransaction(
      {
        workspaceId: initialization.workspace.id,
        bankAccountId: accountOverview.bankAccounts![0]!.id,
        bookingDate: "2026-05-16",
        amount: `-${total}`,
        currency: "EUR",
        description: "Supplier payment"
      },
      database
    );

    return {
      supplierInvoiceId: supplierInvoiceOverview.supplierInvoice!.id,
      bankTransactionId: transactionOverview.bankTransactions![0]!.id
    };
  }
});

function balanceFor(
  balances: Array<{ accountCode: string; amount: string }>,
  accountCode: string
) {
  return balances.find((balance) => balance.accountCode === accountCode)?.amount;
}
