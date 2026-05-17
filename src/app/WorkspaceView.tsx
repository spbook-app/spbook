import { Link, Outlet, useMatches, useRouterState } from "@tanstack/react-router";
import {
  getWorkspaceSectionFromPath,
  workspaceSections
} from "../pages/workspace/model";
import { WorkspaceSidebar } from "../widgets/workspace-sidebar/WorkspaceSidebar";
import { workspaceRoute } from "./router";

export function WorkspaceView() {
  const data = workspaceRoute.useLoaderData();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeSection = getWorkspaceSectionFromPath(pathname);
  const activeSectionMeta =
    workspaceSections.find((s) => s.id === activeSection) ?? workspaceSections[0]!;

  const matches = useMatches();
  const breadcrumbs = matches.flatMap((match) => {
    const staticLabel = match.staticData.breadcrumb;
    const loaderLabel = (match.loaderData as { breadcrumb?: string } | null)?.breadcrumb;
    const label = staticLabel ?? loaderLabel;
    return label ? [{ label, path: match.pathname }] : [];
  });

  const pageTitle = breadcrumbs.at(-1)?.label ?? activeSectionMeta.label;

  return (
    <div className="workspace-layout">
      <WorkspaceSidebar
        workspace={data.workspace}
        invoices={data.invoices}
        supplierInvoices={data.supplierInvoices}
        bankTransactions={data.bankTransactions}
        activeSection={activeSection}
      />
      <section className="workspace-main" aria-label={activeSectionMeta.label}>
        <header className="workspace-toolbar">
          <div className="workspace-toolbar-context">
            {breadcrumbs.length > 0 ? (
              <nav className="breadcrumbs" aria-label="Breadcrumb">
                {breadcrumbs.map((crumb, index) => (
                  <span key={`${crumb.label}-${index}`}>
                    {crumb.path ? (
                      <Link to={crumb.path}>{crumb.label}</Link>
                    ) : (
                      crumb.label
                    )}
                  </span>
                ))}
              </nav>
            ) : null}
            <h1>{pageTitle}</h1>
          </div>
        </header>

        <Outlet />
      </section>
    </div>
  );
}

