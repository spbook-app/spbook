import { describe, expect, it } from "vitest";
import type { Account } from "./entities";
import { findDuplicateAccountCodes, validateUniqueAccountCodes } from "./accounts";

const baseAccount: Account = {
  id: "acc_1100",
  workspaceId: "ws_demo",
  code: "1100",
  name: "Business bank account A",
  role: "posting",
  active: true
};

describe("account validation", () => {
  it("detects duplicate account codes", () => {
    const accounts: Account[] = [
      baseAccount,
      { ...baseAccount, id: "acc_1100_duplicate" }
    ];

    expect(findDuplicateAccountCodes(accounts)).toEqual(["1100"]);
    expect(validateUniqueAccountCodes(accounts)).toEqual({
      ok: false,
      issues: [
        {
          code: "account.duplicate_code",
          message: 'Account code "1100" is used more than once.',
          path: "accounts"
        }
      ]
    });
  });

  it("passes unique account codes", () => {
    const accounts: Account[] = [
      baseAccount,
      { ...baseAccount, id: "acc_1200", code: "1200", name: "Receivables" }
    ];

    expect(validateUniqueAccountCodes(accounts)).toEqual({ ok: true });
  });
});
