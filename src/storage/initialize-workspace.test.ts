import { afterEach, describe, expect, it } from "vitest";
import { defaultCountryConfig } from "../app/country-config";
import type { CountryConfig } from "../countries/model";
import type { Account, Workspace } from "../domain";
import { createDatabase, type SpbookDatabase } from "./db";
import { initializeDefaultWorkspace } from "./initialize-workspace";
import {
  clearDatabase,
  getAccountsByWorkspaceId,
  getFirstWorkspace,
  saveWorkspaceWithAccounts
} from "./repositories";

let database: SpbookDatabase | null = null;

function testDatabase() {
  database = createDatabase(`spbook_test_${crypto.randomUUID()}`);
  return database;
}

afterEach(async () => {
  if (database) {
    await database.delete();
    database = null;
  }
});

describe("initializeDefaultWorkspace", () => {
  it("creates a default workspace and seed accounts", async () => {
    const db = testDatabase();
    const result = await initializeDefaultWorkspace(defaultCountryConfig, db);

    expect(result.created).toBe(true);
    expect(result.workspace.countryCode).toBe("SI");
    expect(result.workspace.baseCurrency).toBe("EUR");
    expect(result.accounts).toHaveLength(17);
    expect(await getFirstWorkspace(db)).toEqual(result.workspace);
  });

  it("is idempotent", async () => {
    const db = testDatabase();
    const first = await initializeDefaultWorkspace(defaultCountryConfig, db);
    const second = await initializeDefaultWorkspace(defaultCountryConfig, db);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.workspace.id).toBe(first.workspace.id);
    expect(second.accounts).toHaveLength(first.accounts.length);
  });

  it("reuses an existing workspace", async () => {
    const db = testDatabase();
    const workspace = {
      ...defaultCountryConfig.createDefaultWorkspace(new Date("2026-05-10T12:00:00Z")),
      id: "ws_existing",
      name: "Existing Workspace"
    };
    const accounts = defaultCountryConfig.createDefaultAccounts(workspace.id);

    await saveWorkspaceWithAccounts(workspace, accounts, db);

    const result = await initializeDefaultWorkspace(defaultCountryConfig, db);

    expect(result.created).toBe(false);
    expect(result.workspace.id).toBe("ws_existing");
    expect(result.accounts).toHaveLength(accounts.length);
  });

  it("reads saved workspace accounts through repository functions", async () => {
    const db = testDatabase();
    const result = await initializeDefaultWorkspace(defaultCountryConfig, db);
    const accounts = await getAccountsByWorkspaceId(result.workspace.id, db);

    expect(accounts.map((account) => account.code)).toContain("1100");
    expect(accounts.map((account) => account.code)).toContain("7600");
  });

  it("can clear the test database", async () => {
    const db = testDatabase();
    await initializeDefaultWorkspace(defaultCountryConfig, db);
    await clearDatabase(db);

    expect(await getFirstWorkspace(db)).toBeUndefined();
  });

  it("can initialize a workspace from a non-default country config", async () => {
    const db = testDatabase();
    const customCountryConfig: CountryConfig = {
      code: "TS",
      name: "Testland",
      defaultCurrency: "TST",
      createDefaultWorkspace: (now = new Date()): Workspace => {
        const timestamp = now.toISOString();

        return {
          id: "ws_test",
          name: "Test Workspace",
          countryCode: "TS",
          baseCurrency: "TST",
          createdAt: timestamp,
          updatedAt: timestamp
        };
      },
      createDefaultAccounts: (workspaceId: string): Account[] => [
        {
          id: "acc_test_cash",
          workspaceId,
          code: "1000",
          name: "Test cash account",
          role: "posting",
          currency: "TST",
          active: true
        }
      ]
    };

    const result = await initializeDefaultWorkspace(customCountryConfig, db);

    expect(result.created).toBe(true);
    expect(result.workspace.countryCode).toBe("TS");
    expect(result.workspace.baseCurrency).toBe("TST");
    expect(result.accounts).toEqual([
      expect.objectContaining({
        code: "1000",
        currency: "TST"
      })
    ]);
  });
});
