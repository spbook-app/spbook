import { appMeta } from "../../app/app-meta";

export type WorkspaceSection =
  | "dashboard"
  | "sales"
  | "purchases"
  | "banking"
  | "counterparties"
  | "accounting"
  | "settings";

export const workspaceSections: Array<{
  id: WorkspaceSection;
  label: string;
  description: string;
}> = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Workspace health and open work"
  },
  {
    id: "sales",
    label: "Sales",
    description: "Issued invoices and receipts"
  },
  {
    id: "purchases",
    label: "Purchases",
    description: "Supplier invoices and payments"
  },
  {
    id: "banking",
    label: "Banking",
    description: "Bank accounts and transactions"
  },
  {
    id: "counterparties",
    label: "Counterparties",
    description: "Customers, suppliers, banks, owner"
  },
  {
    id: "accounting",
    label: "Accounting",
    description: "Journal entries, balances, accounts"
  },
  {
    id: "settings",
    label: "Settings",
    description: "Local workspace controls"
  }
];

export function getSectionLead(section: WorkspaceSection) {
  switch (section) {
    case "dashboard":
      return appMeta.description;
    case "sales":
      return "Create issued invoices, review invoice status, and match incoming bank transactions.";
    case "purchases":
      return "Record supplier invoices, owner transactions, and outgoing payments.";
    case "banking":
      return "Maintain bank accounts, add signed bank transactions, and post bank fees.";
    case "counterparties":
      return "Keep customers, suppliers, banks, owner, and tax authority records in one place.";
    case "accounting":
      return "Inspect balances, journal entries, and the seeded chart of accounts.";
    case "settings":
      return "Review local workspace status and development-only controls.";
  }
}
