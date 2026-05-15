import { afterEach, describe, expect, it } from "vitest";
import { createDefaultSloveniaAccounts, createDefaultSloveniaWorkspace } from "../seed/slovenia";
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
    const result = await initializeDefaultWorkspace(db);

    expect(result.created).toBe(true);
    expect(result.workspace.countryCode).toBe("SI");
    expect(result.workspace.baseCurrency).toBe("EUR");
    expect(result.accounts).toHaveLength(17);
    expect(await getFirstWorkspace(db)).toEqual(result.workspace);
  });

  it("is idempotent", async () => {
    const db = testDatabase();
    const first = await initializeDefaultWorkspace(db);
    const second = await initializeDefaultWorkspace(db);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.workspace.id).toBe(first.workspace.id);
    expect(second.accounts).toHaveLength(first.accounts.length);
  });

  it("reuses an existing workspace", async () => {
    const db = testDatabase();
    const workspace = {
      ...createDefaultSloveniaWorkspace(new Date("2026-05-10T12:00:00Z")),
      id: "ws_existing",
      name: "Existing Workspace"
    };
    const accounts = createDefaultSloveniaAccounts(workspace.id);

    await saveWorkspaceWithAccounts(workspace, accounts, db);

    const result = await initializeDefaultWorkspace(db);

    expect(result.created).toBe(false);
    expect(result.workspace.id).toBe("ws_existing");
    expect(result.accounts).toHaveLength(accounts.length);
  });

  it("reads saved workspace accounts through repository functions", async () => {
    const db = testDatabase();
    const result = await initializeDefaultWorkspace(db);
    const accounts = await getAccountsByWorkspaceId(result.workspace.id, db);

    expect(accounts.map((account) => account.code)).toContain("1100");
    expect(accounts.map((account) => account.code)).toContain("7600");
  });

  it("can clear the test database", async () => {
    const db = testDatabase();
    await initializeDefaultWorkspace(db);
    await clearDatabase(db);

    expect(await getFirstWorkspace(db)).toBeUndefined();
  });
});
