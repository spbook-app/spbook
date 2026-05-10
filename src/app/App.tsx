import { useEffect, useState } from "react";
import { buildInfo } from "../generated/build-info";
import { initializeDefaultWorkspace } from "../storage/initialize-workspace";
import { appMeta } from "./app-meta";
import {
  formatAppBuildLabel,
  getAppEnvironment,
  getAppEnvironmentLabel,
  shouldShowEnvironmentBadge
} from "./app-env";

type LocalWorkspaceStatus =
  | {
      state: "initializing";
    }
  | {
      state: "ready";
      workspaceName: string;
      accountsCount: number;
      created: boolean;
    }
  | {
      state: "error";
      message: string;
    };

export function App() {
  const appEnvironment = getAppEnvironment();
  const [localWorkspaceStatus, setLocalWorkspaceStatus] =
    useState<LocalWorkspaceStatus>({
      state: "initializing"
    });

  useEffect(() => {
    let cancelled = false;

    initializeDefaultWorkspace()
      .then((result) => {
        if (cancelled) return;

        setLocalWorkspaceStatus({
          state: "ready",
          workspaceName: result.workspace.name,
          accountsCount: result.accounts.length,
          created: result.created
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;

        setLocalWorkspaceStatus({
          state: "error",
          message: error instanceof Error ? error.message : "Unknown storage error"
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="app-shell" aria-labelledby="app-title">
      <section className="intro-panel">
        <div className="intro-header">
          <p className="eyebrow">{appMeta.status}</p>
          {shouldShowEnvironmentBadge(appEnvironment) ? (
            <span className="environment-badge">
              {getAppEnvironmentLabel(appEnvironment)} ·{" "}
              {formatAppBuildLabel(buildInfo)}
            </span>
          ) : null}
        </div>
        <h1 id="app-title">{appMeta.name}</h1>
        <p className="tagline">{appMeta.tagline}</p>
        <p className="description">{appMeta.description}</p>
        <dl className="status-grid" aria-label="Application baseline">
          <div>
            <dt>Runtime</dt>
            <dd>PWA-ready shell</dd>
          </div>
          <div>
            <dt>Storage</dt>
            <dd>{formatLocalWorkspaceStatus(localWorkspaceStatus)}</dd>
          </div>
          <div>
            <dt>Deployment</dt>
            <dd>Cloudflare Pages compatible</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

function formatLocalWorkspaceStatus(status: LocalWorkspaceStatus) {
  if (status.state === "initializing") {
    return "Initializing local workspace";
  }

  if (status.state === "error") {
    return `Local storage error: ${status.message}`;
  }

  const action = status.created ? "Created" : "Loaded";

  return `${action}: ${status.workspaceName}, ${status.accountsCount} accounts`;
}
