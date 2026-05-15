import { beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type SpbookDatabase } from "../storage/db";
import { initializeDefaultWorkspace } from "../storage/initialize-workspace";
import { createWorkspaceAccount, updateWorkspaceAccount } from "./account-workflow";

describe("account workflow", () => {
  let database: SpbookDatabase;

  beforeEach(() => {
    database = createDatabase(`spbook_account_workflow_test_${crypto.randomUUID()}`);
  });

  it("creates a posting account manually", async () => {
    const initialization = await initializeDefaultWorkspace(database);
    const overview = await createWorkspaceAccount(
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

    expect(overview.accounts.map((account) => account.code)).toContain("1101");
    expect(overview.accounts.find((account) => account.code === "1101")).toMatchObject({
      name: "Second bank account",
      parentCode: "11",
      role: "posting",
      currency: "EUR",
      active: true
    });
  });

  it("updates editable account fields", async () => {
    const initialization = await initializeDefaultWorkspace(database);
    const targetAccount = initialization.accounts.find((account) => account.code === "1100")!;
    const overview = await updateWorkspaceAccount(
      {
        accountId: targetAccount.id,
        name: "Main operating bank account",
        parentCode: "11",
        currency: "EUR",
        active: false
      },
      database
    );

    expect(overview.accounts.find((account) => account.code === "1100")).toMatchObject({
      code: "1100",
      name: "Main operating bank account",
      active: false
    });
  });

  it("rejects duplicate account codes", async () => {
    const initialization = await initializeDefaultWorkspace(database);

    await expect(
      createWorkspaceAccount(
        {
          workspaceId: initialization.workspace.id,
          code: "1100",
          name: "Duplicate bank account",
          role: "posting",
          parentCode: "11",
          currency: "EUR"
        },
        database
      )
    ).rejects.toThrow('Account code "1100" is already used.');
  });
});
