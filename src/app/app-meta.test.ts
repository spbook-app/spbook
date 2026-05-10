import { describe, expect, it } from "vitest";
import {
  getAppEnvironment,
  getAppEnvironmentLabel,
  shouldShowEnvironmentBadge
} from "./app-env";
import { appMeta } from "./app-meta";

describe("appMeta", () => {
  it("describes the scaffolded application shell", () => {
    expect(appMeta.name).toBe("Spbook");
    expect(appMeta.status).toBe("MVP scaffold");
    expect(appMeta.tagline).toContain("database");
  });

  it("falls back to the local environment", () => {
    expect(getAppEnvironment()).toBe("local");
    expect(getAppEnvironment("unexpected")).toBe("local");
  });

  it("hides the environment badge for production", () => {
    expect(getAppEnvironmentLabel("development")).toBe("Development");
    expect(shouldShowEnvironmentBadge("development")).toBe(true);
    expect(shouldShowEnvironmentBadge("production")).toBe(false);
  });
});
