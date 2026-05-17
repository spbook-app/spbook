import type { Account, Workspace } from "../domain";

export interface CountryConfig {
  code: string;
  name: string;
  defaultCurrency: string;
  createDefaultWorkspace(now?: Date): Workspace;
  createDefaultAccounts(workspaceId: string): Account[];
}
