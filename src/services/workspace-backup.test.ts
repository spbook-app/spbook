import { beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type SpbookDatabase } from "../storage/db";
import { createWorkflowStorage } from "../storage/workflow-persistence";
import { initializeDefaultWorkspace } from "../storage/initialize-workspace";
import { defaultCountryConfig } from "../app/country-config";
import { clearDatabase } from "../storage/repositories";
import anonymizedBackupFixture from "../test/fixtures/spbook-backup-si-demo-anonymized.json";
import { createWorkspaceAccount } from "./account-workflow";
import {
  exportWorkspaceBackup,
  importWorkspaceBackup,
  parseWorkspaceBackup,
  type WorkspaceBackup
} from "./workspace-backup";

describe("workspace backup", () => {
  let database: SpbookDatabase;

  beforeEach(() => {
    database = createDatabase(`spbook_workspace_backup_test_${crypto.randomUUID()}`);
  });

  it("exports and imports local workspace data", async () => {
    const initialization = await initializeDefaultWorkspace(defaultCountryConfig, database);
    await createWorkspaceAccount(
      {
        workspaceId: initialization.workspace.id,
        code: "1101",
        name: "Second bank account",
        role: "posting",
        parentCode: "11",
        currency: "EUR"
      },
      createWorkflowStorage(database)
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

  it("imports the anonymized Slovenia demo backup fixture", async () => {
    const backup = anonymizedBackupFixture as WorkspaceBackup;

    const overview = await importWorkspaceBackup(backup, database);

    expect(overview.workspace.id).toBe("ws_demo_001");
    expect(overview.workspace.name).toBe("Demo Slovenian s.p. Workspace");
    expect(overview.bankAccounts).toHaveLength(2);
    expect(overview.bankTransactions).toHaveLength(9);
    expect(overview.parties.every((party) => party.name.startsWith("Demo "))).toBe(true);
    expect(
      overview.bankTransactions.every((bankTransaction) =>
        bankTransaction.externalId?.startsWith("demo-external-")
      )
    ).toBe(true);
  });
});
