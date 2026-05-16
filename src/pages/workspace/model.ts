import { appMeta } from "../../app/app-meta";

export type WorkspaceSection =
  | "dashboard"
  | "sales"
  | "purchases"
  | "bank-accounts"
  | "bank-transactions"
  | "counterparties"
  | "chart"
  | "journal"
  | "settings";

export type WorkspaceSectionPath =
  | "/workspace/dashboard"
  | "/workspace/sales/invoices"
  | "/workspace/purchases/supplier-invoices"
  | "/workspace/banking/accounts"
  | "/workspace/banking/transactions"
  | "/workspace/counterparties"
  | "/workspace/accounting/chart"
  | "/workspace/accounting/journal-entries"
  | "/workspace/settings";

export const workspaceSections: Array<{
  id: WorkspaceSection;
  path: WorkspaceSectionPath;
  label: string;
  description: string;
}> = [
  {
    id: "dashboard",
    path: "/workspace/dashboard",
    label: "Dashboard",
    description: "Workspace health and open work"
  },
  {
    id: "sales",
    path: "/workspace/sales/invoices",
    label: "Sales",
    description: "Issued invoices and receipts"
  },
  {
    id: "purchases",
    path: "/workspace/purchases/supplier-invoices",
    label: "Purchases",
    description: "Supplier invoices and payments"
  },
  {
    id: "bank-accounts",
    path: "/workspace/banking/accounts",
    label: "Bank accounts",
    description: "Account registry, IBANs, and linked records"
  },
  {
    id: "bank-transactions",
    path: "/workspace/banking/transactions",
    label: "Transactions",
    description: "Imported and manual bank movements"
  },
  {
    id: "counterparties",
    path: "/workspace/counterparties",
    label: "Counterparties",
    description: "Customers, suppliers, banks, owner"
  },
  {
    id: "chart",
    path: "/workspace/accounting/chart",
    label: "Chart of accounts",
    description: "Account codes, roles, and running balances"
  },
  {
    id: "journal",
    path: "/workspace/accounting/journal-entries",
    label: "Journal entries",
    description: "Accounting records posted by the system"
  },
  {
    id: "settings",
    path: "/workspace/settings",
    label: "Settings",
    description: "Local workspace controls"
  }
];

export function getWorkspaceSectionFromPath(pathname: string): WorkspaceSection {
  const [, basePath, sectionPath, areaPath] = pathname.split("/");

  if (basePath !== "workspace") {
    return "dashboard";
  }

  if (sectionPath === "banking") {
    return areaPath === "transactions" ? "bank-transactions" : "bank-accounts";
  }

  if (sectionPath === "accounting") {
    return areaPath === "chart" ? "chart" : "journal";
  }

  const section = workspaceSections.find((item) => item.id === sectionPath);

  return section?.id ?? "dashboard";
}

export function getSectionLead(section: WorkspaceSection) {
  switch (section) {
    case "dashboard":
      return appMeta.description;
    case "sales":
      return "Create issued invoices, review invoice status, and match incoming bank transactions.";
    case "purchases":
      return "Record supplier invoices, owner transactions, and outgoing payments.";
    case "bank-accounts":
      return "Maintain bank accounts and review their IBAN, currency, and linked records.";
    case "bank-transactions":
      return "Review imported and manual account movements, match invoices, and post bank fees.";
    case "counterparties":
      return "Keep customers, suppliers, banks, owner, and tax authority records in one place.";
    case "chart":
      return "Browse account codes, review roles, and check current balances.";
    case "journal":
      return "Inspect accounting records generated from invoices, payments, and bank postings.";
    case "settings":
      return "Review local workspace status and development-only controls.";
  }
}
