import type { Account, Workspace } from "../domain";
import { validateUniqueAccountCodes } from "../domain";
import type { CountryConfig } from "../countries/model";
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
  countryConfig: CountryConfig,
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

  const workspace = countryConfig.createDefaultWorkspace();
  const accounts = countryConfig.createDefaultAccounts(workspace.id);
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
