import { beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type SpbookDatabase } from "../storage/db";
import { initializeDefaultWorkspace } from "../storage/initialize-workspace";
import { clearDatabase } from "../storage/repositories";
import { createWorkspaceAccount } from "./account-workflow";
import {
  exportWorkspaceBackup,
  importWorkspaceBackup,
  parseWorkspaceBackup
} from "./workspace-backup";

describe("workspace backup", () => {
  let database: SpbookDatabase;

  beforeEach(() => {
    database = createDatabase(`spbook_workspace_backup_test_${crypto.randomUUID()}`);
  });

  it("exports and imports local workspace data", async () => {
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
    const backup = await exportWorkspaceBackup(database);

    await clearDatabase(database);

    const overview = await importWorkspaceBackup(backup, database);

    expect(overview.workspace.id).toBe(initialization.workspace.id);
    expect(overview.accounts.map((account) => account.code)).toContain("1101");
  });

  it("rejects unsupported backup files", () => {
    expect(() => parseWorkspaceBackup("{}")).toThrow(
      "Backup file format is not supported."
    );
  });
});
