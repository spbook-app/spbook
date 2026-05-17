import { readdir, readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type SpbookDatabase } from "../storage/db";
import { createWorkflowStorage } from "../storage/workflow-persistence";
import { initializeDefaultWorkspace } from "../storage/initialize-workspace";
import { defaultCountryConfig } from "../app/country-config";
import { createBankAccount } from "./bank-workflow";
import {
  autoLinkImportedBankTransactions,
  importCamt053BankTransactions,
  parseCamt053Statement
} from "./camt053-import";
import { createParty } from "./party-workflow";

const sampleStatementDirectory = "../spbook-localdoc/sources/original-xml";
const sampleStatementPath = `${sampleStatementDirectory}/SI56028430300037670_20260413_1.xml`;

describe("CAMT.053 import", () => {
  let database: SpbookDatabase;

  beforeEach(() => {
    database = createDatabase(`spbook_camt053_import_test_${crypto.randomUUID()}`);
  });

  it("parses NLB CAMT.053.001.08 statement samples", async () => {
    const sampleFiles = (await readdir(sampleStatementDirectory)).filter((fileName) =>
      fileName.endsWith(".xml")
    );

    expect(sampleFiles.length).toBeGreaterThan(0);

    for (const sampleFile of sampleFiles) {
      const xml = await readFile(`${sampleStatementDirectory}/${sampleFile}`, "utf8");
      const statement = parseCamt053Statement(xml);

      expect(statement.accountIban).toBe("SI56028430300037670");
      expect(statement.currency).toBe("EUR");
      expect(statement.entries.length).toBeGreaterThan(0);
      expect(statement.entries[0]).toMatchObject({
        currency: "EUR"
      });
      expect(statement.entries[0]?.bookingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(statement.entries[0]?.amount).toMatch(/^-?\d+\.\d{2}$/);
    }
  });

  it("imports CAMT.053 entries and skips duplicate imported entries", async () => {
    const initialization = await initializeDefaultWorkspace(defaultCountryConfig, database);
    const accountOverview = await createBankAccount(
      {
        workspaceId: initialization.workspace.id,
        name: "NLB EUR",
        accountCode: "1100",
        currency: "EUR",
        iban: "SI56 0284 3030 0037 670"
      },
      database
    );
    const xml = await readFile(sampleStatementPath, "utf8");
    const firstImport = await importCamt053BankTransactions(
      {
        workspaceId: initialization.workspace.id,
        bankAccountId: accountOverview.bankAccounts[0]!.id,
        xml
      },
      database
    );
    const secondImport = await importCamt053BankTransactions(
      {
        workspaceId: initialization.workspace.id,
        bankAccountId: accountOverview.bankAccounts[0]!.id,
        xml
      },
      database
    );

    expect(firstImport.importedCount).toBe(firstImport.statement.entries.length);
    expect(firstImport.skippedCount).toBe(0);
    expect(secondImport.importedCount).toBe(0);
    expect(secondImport.skippedCount).toBe(firstImport.statement.entries.length);
    expect(secondImport.bankingSlice.bankTransactions).toHaveLength(
      firstImport.statement.entries.length
    );
    expect(secondImport.bankingSlice.bankTransactions[0]).toMatchObject({
      importSource: "camt053",
      status: "unmatched"
    });
    expect(secondImport.bankingSlice.bankTransactions[0]?.entryReference).toBeTruthy();
  });

  it("links imported entries to existing counterparties by IBAN", async () => {
    const initialization = await initializeDefaultWorkspace(defaultCountryConfig, database);
    const accountOverview = await createBankAccount(
      {
        workspaceId: initialization.workspace.id,
        name: "NLB EUR",
        accountCode: "1100",
        currency: "EUR",
        iban: "SI56 0284 3030 0037 670"
      },
      database
    );
    const partyOverview = await createParty(
      {
        workspaceId: initialization.workspace.id,
        name: "NLB d.d.",
        type: "business",
        roles: ["bank"],
        iban: "SI56 0290 0000 0200 020"
      },
      createWorkflowStorage(database)
    );
    const xml = await readFile(
      `${sampleStatementDirectory}/SI56028430300037670_20260330_1.xml`,
      "utf8"
    );
    const result = await importCamt053BankTransactions(
      {
        workspaceId: initialization.workspace.id,
        bankAccountId: accountOverview.bankAccounts[0]!.id,
        xml
      },
      database
    );

    expect(result.bankingSlice.bankTransactions.some(
      (bankTransaction) => bankTransaction.partyId === partyOverview.parties[0]!.id
    )).toBe(true);
  });

  it("auto-links previously imported entries to existing counterparties", async () => {
    const initialization = await initializeDefaultWorkspace(defaultCountryConfig, database);
    const accountOverview = await createBankAccount(
      {
        workspaceId: initialization.workspace.id,
        name: "NLB EUR",
        accountCode: "1100",
        currency: "EUR",
        iban: "SI56 0284 3030 0037 670"
      },
      database
    );
    const xml = await readFile(
      `${sampleStatementDirectory}/SI56028430300037670_20260330_1.xml`,
      "utf8"
    );
    await importCamt053BankTransactions(
      {
        workspaceId: initialization.workspace.id,
        bankAccountId: accountOverview.bankAccounts[0]!.id,
        xml
      },
      database
    );
    const partyOverview = await createParty(
      {
        workspaceId: initialization.workspace.id,
        name: "NLB d.d.",
        type: "business",
        roles: ["bank"],
        iban: "SI56 0290 0000 0200 020"
      },
      createWorkflowStorage(database)
    );

    const result = await autoLinkImportedBankTransactions(
      initialization.workspace.id,
      database
    );

    expect(result.linkedCount).toBeGreaterThan(0);
    expect(result.bankingSlice.bankTransactions.some(
      (bankTransaction) => bankTransaction.partyId === partyOverview.parties[0]!.id
    )).toBe(true);
  });
});
