import { useMemo } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  getWorkspaceSectionFromPath,
  type WorkspaceSection,
  type WorkspaceSectionPath,
  workspaceSections
} from "../pages/workspace/model";
import { AccountingView } from "../widgets/accounting/AccountingView";
import { BankingPanel } from "../widgets/banking/BankingPanel";
import { CounterpartiesView } from "../widgets/counterparties/CounterpartiesView";
import { DashboardView } from "../widgets/dashboard/DashboardView";
import { PurchasesView } from "../widgets/purchases/PurchasesView";
import { SalesInvoicesView } from "../widgets/sales/SalesInvoicesView";
import { SettingsPanel } from "../widgets/settings/SettingsPanel";
import { WorkspaceSidebar } from "../widgets/workspace-sidebar/WorkspaceSidebar";
import type { AppDataState } from "./App";

export function WorkspaceView({
  data,
  onDataStateChange,
  showReset
}: {
  data: Extract<AppDataState, { state: "ready" }>;
  onDataStateChange: (state: AppDataState) => void;
  showReset: boolean;
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname
  });
  const activeSection = getWorkspaceSectionFromPath(pathname);
  const accountNames = useMemo(
    () => new Map(data.accounts.map((account) => [account.code, account.name])),
    [data.accounts]
  );
  const activeSectionMeta =
    workspaceSections.find((section) => section.id === activeSection) ??
    workspaceSections[0]!;
  const pageTitle = getWorkspacePageTitle(pathname, activeSectionMeta.label, data);

  return (
    <div className="workspace-layout">
      <WorkspaceSidebar
        activeSection={activeSection}
        data={data}
      />
      <section className="workspace-main" aria-label={activeSectionMeta.label}>
        <header className="workspace-toolbar">
          <div className="workspace-toolbar-context">
            <WorkspaceBreadcrumbs data={data} pathname={pathname} />
            <h1>{pageTitle}</h1>
          </div>
        </header>

        {activeSection === "dashboard" ? <DashboardView data={data} accountNames={accountNames} /> : null}
        {activeSection === "sales" ? (
          <div className="section-stack">
            <SalesInvoicesView data={data} onDataStateChange={onDataStateChange} />
          </div>
        ) : null}
        {activeSection === "purchases" ? (
          <div className="section-stack">
            <PurchasesView data={data} onDataStateChange={onDataStateChange} />
          </div>
        ) : null}
        {activeSection === "banking" ? (
          <div className="section-stack">
            <BankingPanel data={data} onDataStateChange={onDataStateChange} />
          </div>
        ) : null}
        {activeSection === "counterparties" ? (
          <div className="section-stack">
            <CounterpartiesView data={data} onDataStateChange={onDataStateChange} />
          </div>
        ) : null}
        {activeSection === "accounting" ? (
          <div className="section-stack">
            <AccountingView
              accountNames={accountNames}
              data={data}
              onDataStateChange={onDataStateChange}
            />
          </div>
        ) : null}
        {activeSection === "settings" ? (
          <SettingsPanel
            data={data}
            onDataStateChange={onDataStateChange}
            showReset={showReset}
          />
        ) : null}
      </section>
    </div>
  );
}

function WorkspaceBreadcrumbs({
  data,
  pathname
}: {
  data: Extract<AppDataState, { state: "ready" }>;
  pathname: string;
}) {
  const breadcrumbs = getWorkspaceBreadcrumbs(pathname, data);

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {breadcrumbs.map((breadcrumb, index) => (
        <span key={`${breadcrumb.label}-${index}`}>
          {breadcrumb.path ? (
            <Link to={breadcrumb.path}>{breadcrumb.label}</Link>
          ) : (
            breadcrumb.label
          )}
        </span>
      ))}
    </nav>
  );
}

type BreadcrumbPath =
  | WorkspaceSectionPath
  | "/workspace/purchases/owner-transactions"
  | "/workspace/banking/transactions"
  | "/workspace/accounting/chart";

type Breadcrumb = {
  label: string;
  path?: BreadcrumbPath;
};

function getWorkspaceBreadcrumbs(
  pathname: string,
  data: Extract<AppDataState, { state: "ready" }>
) {
  const [workspace, section, areaOrEntity, entityIdOrMode, mode] = pathname
    .split("/")
    .filter(Boolean);

  if (workspace !== "workspace" || !section) {
    return [];
  }

  const sectionMeta = workspaceSections.find(
    (candidate) => candidate.id === section
  ) as
    | (typeof workspaceSections)[number]
    | undefined;

  if (!sectionMeta) {
    return [];
  }

  const breadcrumbs: Breadcrumb[] = [{ label: sectionMeta.label, path: sectionMeta.path }];

  if (!areaOrEntity) {
    return breadcrumbs;
  }

  if (section === "counterparties") {
    breadcrumbs.push({
      label:
        areaOrEntity === "new"
          ? "New"
          : getEntityLabel(section, undefined, areaOrEntity, data)
    });

    if (entityIdOrMode) {
      breadcrumbs.push({ label: formatRouteSegment(entityIdOrMode) });
    }

    return breadcrumbs;
  }

  const areaPath = getWorkspaceAreaPath(section, areaOrEntity);

  breadcrumbs.push({
    label: getAreaLabel(areaOrEntity),
    path: areaPath
  });

  if (entityIdOrMode && entityIdOrMode !== "new") {
    breadcrumbs.push({
      label: getEntityLabel(section, areaOrEntity, entityIdOrMode, data)
    });
  } else if (entityIdOrMode === "new") {
    breadcrumbs.push({ label: `New ${getSingularAreaLabel(areaOrEntity)}` });
  }

  if (mode) {
    breadcrumbs.push({ label: formatRouteSegment(mode) });
  }

  return breadcrumbs;
}

function formatRouteSegment(segment: string) {
  return segment
    .split("-")
    .map((part) => (part ? `${part[0]!.toUpperCase()}${part.slice(1)}` : part))
    .join(" ");
}

function getWorkspacePageTitle(
  pathname: string,
  fallbackTitle: string,
  data: Extract<AppDataState, { state: "ready" }>
) {
  const [workspace, section, areaOrEntity, entityIdOrMode, mode] = pathname
    .split("/")
    .filter(Boolean);

  if (workspace !== "workspace") {
    return fallbackTitle;
  }

  if (section === "counterparties") {
    if (entityIdOrMode === "edit") {
      return `Edit ${getEntityLabel(section, undefined, areaOrEntity, data)}`;
    }

    if (areaOrEntity === "new") {
      return "New counterparty";
    }

    if (areaOrEntity) {
      return getEntityLabel(section, undefined, areaOrEntity, data);
    }
  }

  if (mode) {
    return `Edit ${getEntityLabel(section, areaOrEntity, entityIdOrMode, data)}`;
  }

  if (entityIdOrMode === "new") {
    return `New ${getSingularAreaLabel(areaOrEntity)}`;
  }

  if (entityIdOrMode) {
    return getEntityLabel(section, areaOrEntity, entityIdOrMode, data);
  }

  if (areaOrEntity) {
    return getAreaLabel(areaOrEntity);
  }

  return fallbackTitle;
}

function getWorkspaceAreaPath(
  section: string,
  area: string
): BreadcrumbPath | undefined {
  if (section === "sales" && area === "invoices") {
    return "/workspace/sales/invoices";
  }

  if (section === "purchases" && area === "supplier-invoices") {
    return "/workspace/purchases/supplier-invoices";
  }

  if (section === "purchases" && area === "owner-transactions") {
    return "/workspace/purchases/owner-transactions";
  }

  if (section === "banking" && area === "accounts") {
    return "/workspace/banking/accounts";
  }

  if (section === "banking" && area === "transactions") {
    return "/workspace/banking/transactions";
  }

  if (section === "accounting" && area === "journal-entries") {
    return "/workspace/accounting/journal-entries";
  }

  if (section === "accounting" && area === "chart") {
    return "/workspace/accounting/chart";
  }

  return undefined;
}

function getAreaLabel(area: string) {
  switch (area) {
    case "supplier-invoices":
      return "Supplier invoices";
    case "owner-transactions":
      return "Owner transactions";
    case "journal-entries":
      return "Journal entries";
    default:
      return formatRouteSegment(area);
  }
}

function getSingularAreaLabel(area: string | undefined) {
  switch (area) {
    case "accounts":
      return "bank account";
    case "transactions":
      return "bank transaction";
    case "invoices":
      return "invoice";
    case "supplier-invoices":
      return "supplier invoice";
    case "owner-transactions":
      return "owner transaction";
    case "journal-entries":
      return "journal entry";
    case "chart":
      return "account";
    default:
      return "record";
  }
}

function getEntityLabel(
  section: string | undefined,
  area: string | undefined,
  entityId: string | undefined,
  data: Extract<AppDataState, { state: "ready" }>
) {
  if (!entityId) {
    return "Record";
  }

  if (section === "counterparties") {
    return data.parties.find((party) => party.id === entityId)?.name ?? shortId(entityId);
  }

  if (section === "sales" && area === "invoices") {
    const invoice = data.invoices.find((candidate) => candidate.id === entityId);
    return invoice ? `Invoice ${invoice.number}` : shortId(entityId);
  }

  if (section === "purchases" && area === "supplier-invoices") {
    const supplierInvoice = data.supplierInvoices.find(
      (candidate) => candidate.id === entityId
    );
    return supplierInvoice ? `Supplier invoice ${supplierInvoice.number}` : shortId(entityId);
  }

  if (section === "banking" && area === "accounts") {
    return (
      data.bankAccounts.find((bankAccount) => bankAccount.id === entityId)?.name ??
      shortId(entityId)
    );
  }

  if (section === "banking" && area === "transactions") {
    const bankTransaction = data.bankTransactions.find(
      (candidate) => candidate.id === entityId
    );
    return bankTransaction
      ? `${bankTransaction.bookingDate} · ${bankTransaction.amount} ${bankTransaction.currency}`
      : shortId(entityId);
  }

  if (section === "accounting" && area === "journal-entries") {
    const journalEntry = data.journalEntries.find((candidate) => candidate.id === entityId);
    return journalEntry
      ? `${journalEntry.entryDate} · ${journalEntry.description}`
      : shortId(entityId);
  }

  if (section === "accounting" && area === "chart") {
    const account = data.accounts.find((candidate) => candidate.id === entityId);
    return account ? `${account.code} · ${account.name}` : shortId(entityId);
  }

  return shortId(entityId);
}

function shortId(id: string) {
  return id.replaceAll("-", " ").slice(0, 12);
}
