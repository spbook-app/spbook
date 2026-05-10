import type { Account, Workspace } from "../domain";
import { validateUniqueAccountCodes } from "../domain";

export const DEFAULT_SLOVENIA_WORKSPACE_ID = "ws_si_default";

export const DEFAULT_SLOVENIA_ACCOUNT_CODES = [
  "11",
  "1100",
  "1101",
  "12",
  "1200",
  "22",
  "2200",
  "26",
  "2600",
  "28",
  "2850",
  "41",
  "4100",
  "4120",
  "48",
  "4800",
  "76",
  "7600"
] as const;

export function createDefaultSloveniaWorkspace(now = new Date()): Workspace {
  const timestamp = now.toISOString();

  return {
    id: DEFAULT_SLOVENIA_WORKSPACE_ID,
    name: "Slovenian s.p. Workspace",
    countryCode: "SI",
    baseCurrency: "EUR",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function createDefaultSloveniaAccounts(
  workspaceId = DEFAULT_SLOVENIA_WORKSPACE_ID
): Account[] {
  const accounts: Account[] = [
    groupAccount(workspaceId, "11", "Bank accounts"),
    postingAccount(workspaceId, "1100", "11", "Business bank account A"),
    postingAccount(workspaceId, "1101", "11", "Business bank account B"),
    groupAccount(workspaceId, "12", "Trade receivables"),
    postingAccount(workspaceId, "1200", "12", "Receivables from customers"),
    groupAccount(workspaceId, "22", "Trade payables"),
    postingAccount(workspaceId, "2200", "22", "Payables to suppliers"),
    groupAccount(workspaceId, "26", "Tax and contribution liabilities"),
    postingAccount(workspaceId, "2600", "26", "Social contribution liabilities"),
    groupAccount(workspaceId, "28", "Other short-term liabilities"),
    postingAccount(workspaceId, "2850", "28", "Owner contributions and withdrawals"),
    groupAccount(workspaceId, "41", "Service costs"),
    postingAccount(workspaceId, "4100", "41", "Bank fees"),
    postingAccount(workspaceId, "4120", "41", "Professional and administrative costs"),
    groupAccount(workspaceId, "48", "Other costs"),
    postingAccount(workspaceId, "4800", "48", "Owner social contributions"),
    groupAccount(workspaceId, "76", "Operating revenue"),
    postingAccount(workspaceId, "7600", "76", "Service revenue")
  ];

  const validation = validateUniqueAccountCodes(accounts);

  if (!validation.ok) {
    throw new Error("Default Slovenia accounts contain duplicate account codes.");
  }

  return accounts;
}

function groupAccount(workspaceId: string, code: string, name: string): Account {
  return {
    id: `acc_${code}`,
    workspaceId,
    code,
    name,
    role: "group",
    active: true
  };
}

function postingAccount(
  workspaceId: string,
  code: string,
  parentCode: string,
  name: string
): Account {
  return {
    id: `acc_${code}`,
    workspaceId,
    code,
    parentCode,
    name,
    role: "posting",
    currency: "EUR",
    active: true
  };
}
