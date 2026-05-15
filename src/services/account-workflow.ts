import type { Account, AccountRole } from "../domain";
import { db, type SpbookDatabase } from "../storage/db";
import {
  getAccountById,
  getAccountsByWorkspaceId,
  saveAccount
} from "../storage/repositories";
import { loadWorkspaceOverview } from "./workspace-overview";

export type CreateWorkspaceAccountInput = {
  workspaceId: string;
  code: string;
  name: string;
  role: AccountRole;
  parentCode?: string;
  currency?: string;
};

export type UpdateWorkspaceAccountInput = {
  accountId: string;
  name: string;
  parentCode?: string;
  currency?: string;
  active: boolean;
};

export async function createWorkspaceAccount(
  input: CreateWorkspaceAccountInput,
  database: SpbookDatabase = db
) {
  const accounts = await getAccountsByWorkspaceId(input.workspaceId, database);
  const account: Account = {
    id: createEntityId("acc"),
    workspaceId: input.workspaceId,
    code: normalizeCode(input.code),
    name: input.name.trim(),
    role: input.role,
    parentCode: normalizeOptional(input.parentCode),
    currency: normalizeOptional(input.currency),
    active: true
  };

  validateAccount(account, accounts);
  await saveAccount(account, database);

  return loadWorkspaceOverview(input.workspaceId, database);
}

export async function updateWorkspaceAccount(
  input: UpdateWorkspaceAccountInput,
  database: SpbookDatabase = db
) {
  const existingAccount = await getAccountById(input.accountId, database);

  if (!existingAccount) {
    throw new Error(`Account "${input.accountId}" was not found.`);
  }

  const accounts = await getAccountsByWorkspaceId(existingAccount.workspaceId, database);
  const updatedAccount: Account = {
    ...existingAccount,
    name: input.name.trim(),
    parentCode: normalizeOptional(input.parentCode),
    currency: normalizeOptional(input.currency),
    active: input.active
  };

  validateAccount(
    updatedAccount,
    accounts.filter((account) => account.id !== existingAccount.id)
  );
  await saveAccount(updatedAccount, database);

  return loadWorkspaceOverview(existingAccount.workspaceId, database);
}

function validateAccount(account: Account, otherAccounts: Account[]) {
  if (!account.code) {
    throw new Error("Account code is required.");
  }

  if (!/^[0-9]{2,8}$/.test(account.code)) {
    throw new Error("Account code must contain 2 to 8 digits.");
  }

  if (!account.name) {
    throw new Error("Account name is required.");
  }

  if (otherAccounts.some((candidate) => candidate.code === account.code)) {
    throw new Error(`Account code "${account.code}" is already used.`);
  }

  if (account.role === "posting" && !account.parentCode) {
    throw new Error("Posting account parent code is required.");
  }

  if (account.parentCode) {
    const parentAccount = otherAccounts.find(
      (candidate) => candidate.code === account.parentCode
    );

    if (!parentAccount || parentAccount.role !== "group") {
      throw new Error("Parent account must be an existing group account.");
    }
  }

  if (account.role === "group" && account.currency) {
    throw new Error("Group account cannot have a currency.");
  }

  if (account.role === "posting" && !account.currency) {
    throw new Error("Posting account currency is required.");
  }
}

function normalizeCode(value: string) {
  return value.trim();
}

function normalizeOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function createEntityId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}
