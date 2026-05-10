import { describe, expect, it } from "vitest";
import { parseMoneyAmount } from "./money";

describe("parseMoneyAmount", () => {
  it("parses whole amounts", () => {
    expect(parseMoneyAmount("1000")).toEqual({ ok: true, minorUnits: 100000n });
  });

  it("parses amounts with two decimal places", () => {
    expect(parseMoneyAmount("1000.00")).toEqual({ ok: true, minorUnits: 100000n });
  });

  it("parses amounts with one decimal place", () => {
    expect(parseMoneyAmount("1000.5")).toEqual({ ok: true, minorUnits: 100050n });
  });

  it("rejects empty strings", () => {
    expect(parseMoneyAmount("")).toEqual({ ok: false, reason: "invalid_format" });
  });

  it("rejects negative amounts", () => {
    expect(parseMoneyAmount("-10.00")).toEqual({
      ok: false,
      reason: "invalid_format"
    });
  });

  it("rejects amounts with more than two decimal places", () => {
    expect(parseMoneyAmount("10.001")).toEqual({
      ok: false,
      reason: "invalid_format"
    });
  });

  it("rejects zero", () => {
    expect(parseMoneyAmount("0.00")).toEqual({ ok: false, reason: "not_positive" });
  });
});
