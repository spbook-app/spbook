import { beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type SpbookDatabase } from "../storage/db";
import { initializeDefaultWorkspace } from "../storage/initialize-workspace";
import { createSalesInvoice } from "./invoice-workflow";
import { createParty, updateParty } from "./party-workflow";

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
        registrationNumber: "12345678",
        vatId: "SI12345678",
        iban: "SI56 1910 0000 0123 438",
        addressLine1: "Slovenska cesta 1",
        postalCode: "1000",
        city: "Ljubljana",
        region: "Osrednjeslovenska",
        contactName: "Ana Novak",
        email: "INFO@ACME.SI"
      },
      database
    );

    expect(overview.parties).toHaveLength(1);
    expect(overview.parties[0]).toMatchObject({
      name: "ACME d.o.o.",
      type: "business",
      roles: ["customer", "supplier"],
      countryCode: "SI",
      registrationNumber: "12345678",
      vatId: "SI12345678",
      iban: "SI56191000000123438",
      addressLine1: "Slovenska cesta 1",
      postalCode: "1000",
      city: "Ljubljana",
      region: "Osrednjeslovenska",
      contactName: "Ana Novak",
      email: "info@acme.si",
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

  it("updates a counterparty", async () => {
    const initialization = await initializeDefaultWorkspace(database);
    const overview = await createParty(
      {
        workspaceId: initialization.workspace.id,
        name: "ACME d.o.o.",
        type: "business",
        roles: ["customer"],
        countryCode: "SI"
      },
      database
    );
    const updatedOverview = await updateParty(
      {
        partyId: overview.parties[0]!.id,
        name: "ACME Updated d.o.o.",
        type: "business",
        roles: ["customer", "supplier"],
        countryCode: "SI",
        registrationNumber: "87654321",
        vatId: "SI87654321",
        iban: "SI56 1910 0000 0123 438",
        addressLine1: "Dunajska cesta 10",
        postalCode: "1000",
        city: "Ljubljana",
        region: "Osrednjeslovenska",
        contactName: "Janez Novak",
        email: "billing@acme.si",
        active: false
      },
      database
    );

    expect(updatedOverview.parties[0]).toMatchObject({
      name: "ACME Updated d.o.o.",
      roles: ["customer", "supplier"],
      registrationNumber: "87654321",
      vatId: "SI87654321",
      iban: "SI56191000000123438",
      addressLine1: "Dunajska cesta 10",
      postalCode: "1000",
      city: "Ljubljana",
      region: "Osrednjeslovenska",
      contactName: "Janez Novak",
      email: "billing@acme.si",
      active: false
    });
  });

  it("rejects invalid email values", async () => {
    const initialization = await initializeDefaultWorkspace(database);

    await expect(
      createParty(
        {
          workspaceId: initialization.workspace.id,
          name: "ACME d.o.o.",
          type: "business",
          roles: ["customer"],
          email: "not-an-email"
        },
        database
      )
    ).rejects.toThrow("Party email is invalid.");
  });

  it("rejects invalid IBAN values", async () => {
    const initialization = await initializeDefaultWorkspace(database);

    await expect(
      createParty(
        {
          workspaceId: initialization.workspace.id,
          name: "ACME d.o.o.",
          type: "business",
          roles: ["supplier"],
          iban: "not-an-iban"
        },
        database
      )
    ).rejects.toThrow("IBAN is invalid.");
  });

  it("keeps required roles for parties used by documents", async () => {
    const initialization = await initializeDefaultWorkspace(database);
    const overview = await createParty(
      {
        workspaceId: initialization.workspace.id,
        name: "ACME d.o.o.",
        type: "business",
        roles: ["customer"]
      },
      database
    );
    await createSalesInvoice(
      {
        workspaceId: initialization.workspace.id,
        partyId: overview.parties[0]!.id,
        number: "2026-0001",
        issueDate: "2026-05-15",
        total: "1000.00",
        currency: "EUR"
      },
      database
    );

    await expect(
      updateParty(
        {
          partyId: overview.parties[0]!.id,
          name: "ACME d.o.o.",
          type: "business",
          roles: ["supplier"],
          active: true
        },
        database
      )
    ).rejects.toThrow("Party with issued invoices must keep the customer role.");
  });
});
