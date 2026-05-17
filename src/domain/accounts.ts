import type { Account } from "./types";
import { invalid, valid, type ValidationResult } from "./validation";

export function getAccountByCode(accounts: Account[], code: string) {
  return accounts.find((account) => account.code === code) ?? null;
}

export function findDuplicateAccountCodes(accounts: Account[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const account of accounts) {
    if (seen.has(account.code)) {
      duplicates.add(account.code);
    }

    seen.add(account.code);
  }

  return [...duplicates];
}

export function validateUniqueAccountCodes(accounts: Account[]): ValidationResult {
  const duplicateCodes = findDuplicateAccountCodes(accounts);

  if (duplicateCodes.length === 0) {
    return valid();
  }

  return invalid(
    duplicateCodes.map((code) => ({
      code: "account.duplicate_code",
      message: `Account code "${code}" is used more than once.`,
      path: "accounts"
    }))
  );
}
