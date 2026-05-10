import type { Account, Workspace } from "../domain";
import { db, type SpbookDatabase } from "./db";

export function getWorkspaceCount(database: SpbookDatabase = db) {
  return database.workspaces.count();
}

export function getFirstWorkspace(database: SpbookDatabase = db) {
  return database.workspaces.orderBy("id").first();
}

export function getAccountsByWorkspaceId(
  workspaceId: string,
  database: SpbookDatabase = db
) {
  return database.accounts.where("workspaceId").equals(workspaceId).sortBy("code");
}

export async function saveWorkspaceWithAccounts(
  workspace: Workspace,
  accounts: Account[],
  database: SpbookDatabase = db
) {
  await database.transaction("rw", database.workspaces, database.accounts, async () => {
    await database.workspaces.put(workspace);
    await database.accounts.bulkPut(accounts);
  });
}

export async function clearDatabase(database: SpbookDatabase = db) {
  await database.transaction("rw", database.workspaces, database.accounts, async () => {
    await database.accounts.clear();
    await database.workspaces.clear();
  });
}
