import { describe, expect, it } from "vitest";
import { appMeta } from "./app-meta";

describe("appMeta", () => {
  it("describes the scaffolded application shell", () => {
    expect(appMeta.name).toBe("Spbook");
    expect(appMeta.status).toBe("MVP scaffold");
    expect(appMeta.tagline).toContain("database");
  });
});
