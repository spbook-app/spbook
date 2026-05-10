import { beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type SpbookDatabase } from "../storage/db";
import { initializeDefaultWorkspace } from "../storage/initialize-workspace";
import { createParty } from "./party-workflow";

describe("party workflow", () => {
  let database: SpbookDatabase;

  beforeEach(() => {
    database = createDatabase(`spbook_party_workflow_test_${crypto.randomUUID()}`);
  });

  it("creates a counterparty with type, roles, country, and VAT ID", async () => {
    const initialization = await initializeDefaultWorkspace(database);
    const overview = await createParty(
      {
        workspaceId: initialization.workspace.id,
        name: "ACME d.o.o.",
        type: "business",
        roles: ["customer", "supplier"],
        countryCode: "SI",
        vatId: "SI12345678"
      },
      database
    );

    expect(overview.parties).toHaveLength(1);
    expect(overview.parties[0]).toMatchObject({
      name: "ACME d.o.o.",
      type: "business",
      roles: ["customer", "supplier"],
      countryCode: "SI",
      vatId: "SI12345678",
      active: true
    });
  });

  it("rejects a counterparty without roles", async () => {
    const initialization = await initializeDefaultWorkspace(database);

    await expect(
      createParty(
        {
          workspaceId: initialization.workspace.id,
          name: "No Role d.o.o.",
          type: "business",
          roles: []
        },
        database
      )
    ).rejects.toThrow("At least one party role is required.");
  });
});
