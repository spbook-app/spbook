import { useMemo } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  getWorkspaceSectionFromPath,
  getSectionLead,
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

  return (
    <div className="workspace-layout">
      <WorkspaceSidebar
        activeSection={activeSection}
        data={data}
        onDataStateChange={onDataStateChange}
      />
      <section className="workspace-main" aria-label={activeSectionMeta.label}>
        <header className="page-heading">
          <WorkspaceBreadcrumbs pathname={pathname} />
          <p className="eyebrow">{activeSectionMeta.label}</p>
          <h1>{activeSectionMeta.description}</h1>
          <p>{getSectionLead(activeSection)}</p>
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

function WorkspaceBreadcrumbs({ pathname }: { pathname: string }) {
  const breadcrumbs = getWorkspaceBreadcrumbs(pathname);

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

function getWorkspaceBreadcrumbs(pathname: string) {
  const [, workspace, section, area, entityId, mode] = pathname.split("/");

  if (workspace !== "workspace" || !section) {
    return [];
  }

  const sectionMeta = workspaceSections.find((candidate) => candidate.id === section);

  if (!sectionMeta) {
    return [];
  }

  const breadcrumbs: Array<{ label: string; path?: typeof sectionMeta.path }> = [
    { label: sectionMeta.label, path: sectionMeta.path }
  ];

  if (!area) {
    return breadcrumbs;
  }

  breadcrumbs.push({ label: formatRouteSegment(area) });

  if (entityId && entityId !== "new") {
    breadcrumbs.push({ label: formatRouteSegment(entityId) });
  } else if (entityId === "new") {
    breadcrumbs.push({ label: "New" });
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
