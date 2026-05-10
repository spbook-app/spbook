import Dexie, { type Table } from "dexie";
import type { Account, Workspace } from "../domain";

export class SpbookDatabase extends Dexie {
  workspaces!: Table<Workspace, string>;
  accounts!: Table<Account, string>;

  constructor(name = "spbook") {
    super(name);

    this.version(1).stores({
      workspaces: "id, countryCode, baseCurrency, updatedAt",
      accounts: "id, workspaceId, code, parentCode, role, active"
    });
  }
}

export function createDatabase(name?: string) {
  return new SpbookDatabase(name);
}

export const db = createDatabase();
