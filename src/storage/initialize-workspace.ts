import type { Account, Workspace } from "../domain";
import { validateUniqueAccountCodes } from "../domain";
import {
  createDefaultSloveniaAccounts,
  createDefaultSloveniaWorkspace
} from "../seed/slovenia";
import { db, type SpbookDatabase } from "./db";
import {
  getAccountsByWorkspaceId,
  getFirstWorkspace,
  saveWorkspaceWithAccounts
} from "./repositories";

export type WorkspaceInitializationResult = {
  workspace: Workspace;
  accounts: Account[];
  created: boolean;
};

export async function initializeDefaultWorkspace(
  database: SpbookDatabase = db
): Promise<WorkspaceInitializationResult> {
  const existingWorkspace = await getFirstWorkspace(database);

  if (existingWorkspace) {
    return {
      workspace: existingWorkspace,
      accounts: await getAccountsByWorkspaceId(existingWorkspace.id, database),
      created: false
    };
  }

  const workspace = createDefaultSloveniaWorkspace();
  const accounts = createDefaultSloveniaAccounts(workspace.id);
  const validation = validateUniqueAccountCodes(accounts);

  if (!validation.ok) {
    throw new Error("Default workspace accounts are invalid.");
  }

  await saveWorkspaceWithAccounts(workspace, accounts, database);

  return {
    workspace,
    accounts,
    created: true
  };
}
