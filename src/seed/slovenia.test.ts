import { describe, expect, it } from "vitest";
import { validateUniqueAccountCodes } from "../domain";
import {
  createDefaultSloveniaAccounts,
  createDefaultSloveniaWorkspace,
  DEFAULT_SLOVENIA_ACCOUNT_CODES
} from "./slovenia";

describe("Slovenia seed", () => {
  it("creates the default Slovenian workspace", () => {
    expect(createDefaultSloveniaWorkspace(new Date("2026-05-10T12:00:00Z"))).toEqual({
      id: "ws_si_default",
      name: "Slovenian s.p. Workspace",
      countryCode: "SI",
      baseCurrency: "EUR",
      createdAt: "2026-05-10T12:00:00.000Z",
      updatedAt: "2026-05-10T12:00:00.000Z"
    });
  });

  it("creates the expected account codes", () => {
    expect(createDefaultSloveniaAccounts().map((account) => account.code)).toEqual([
      ...DEFAULT_SLOVENIA_ACCOUNT_CODES
    ]);
  });

  it("creates unique account codes", () => {
    expect(validateUniqueAccountCodes(createDefaultSloveniaAccounts())).toEqual({
      ok: true
    });
  });

  it("keeps group accounts currency-free and posting accounts in EUR", () => {
    const accounts = createDefaultSloveniaAccounts();

    expect(accounts.filter((account) => account.role === "group")).toEqual(
      expect.arrayContaining([
        expect.not.objectContaining({
          currency: expect.any(String)
        })
      ])
    );
    expect(accounts.filter((account) => account.role === "posting")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          currency: "EUR"
        })
      ])
    );
  });
});
