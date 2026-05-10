import { useEffect, useState } from "react";
import { buildInfo } from "../generated/build-info";
import type { AccountBalance } from "../services/balances";
import { runDemoInvoicePaymentFlow } from "../services/demo-invoice-flow";
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

type DemoFlowStatus =
  | {
      state: "waiting";
    }
  | {
      state: "running";
    }
  | {
      state: "ready";
      invoiceNumber: string;
      balances: AccountBalance[];
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
  const [demoFlowStatus, setDemoFlowStatus] = useState<DemoFlowStatus>({
    state: "waiting"
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

        setDemoFlowStatus({ state: "running" });

        return runDemoInvoicePaymentFlow(result.workspace.id);
      })
      .then((result) => {
        if (!result || cancelled) return;

        setDemoFlowStatus({
          state: "ready",
          invoiceNumber: result.invoice.number,
          balances: result.balances
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;

        setLocalWorkspaceStatus({
          state: "error",
          message: error instanceof Error ? error.message : "Unknown storage error"
        });
        setDemoFlowStatus({
          state: "error",
          message: error instanceof Error ? error.message : "Unknown demo flow error"
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
        <section className="demo-flow" aria-labelledby="demo-flow-title">
          <div>
            <h2 id="demo-flow-title">Demo flow</h2>
            <p>{formatDemoFlowStatus(demoFlowStatus)}</p>
          </div>
          {demoFlowStatus.state === "ready" ? (
            <ul className="balance-list" aria-label="Demo account balances">
              {demoFlowStatus.balances.map((balance) => (
                <li key={`${balance.accountCode}:${balance.currency}`}>
                  <span>{balance.accountCode}</span>
                  <strong>
                    {balance.amount} {balance.currency}
                  </strong>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
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

function formatDemoFlowStatus(status: DemoFlowStatus) {
  if (status.state === "waiting") {
    return "Waiting for local workspace";
  }

  if (status.state === "running") {
    return "Creating demo invoice and payment";
  }

  if (status.state === "error") {
    return `Demo flow error: ${status.message}`;
  }

  return `Invoice ${status.invoiceNumber} paid`;
}
