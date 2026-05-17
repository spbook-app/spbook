import type { AppDataState } from "../../app/App";
import { formatAppBuildLabel } from "../../app/app-env";
import { buildInfo } from "../../generated/build-info";
import { BackupPanel } from "../../features/backup-restore/BackupPanel";
import { WorkspaceStatusCard } from "../workspace-sidebar/WorkspaceSidebar";

export function SettingsPanel({
  data,
  onDataStateChange,
  showReset
}: {
  data: Extract<AppDataState, { state: "ready" }>;
  onDataStateChange: (state: AppDataState) => void;
  showReset: boolean;
}) {
  return (
    <section className="panel" aria-labelledby="settings-title">
      <div className="panel-header">
        <h2 id="settings-title">Workspace settings</h2>
      </div>
      <dl className="detail-list settings-details">
        <div>
          <dt>Workspace</dt>
          <dd>{data.workspace.name}</dd>
        </div>
        <div>
          <dt>Country</dt>
          <dd>{data.workspace.countryCode}</dd>
        </div>
        <div>
          <dt>Currency</dt>
          <dd>{data.workspace.baseCurrency}</dd>
        </div>
        <div>
          <dt>Storage</dt>
          <dd>{data.initializedWorkspace ? "Created locally" : "Loaded locally"}</dd>
        </div>
        <div>
          <dt>Build</dt>
          <dd>{formatAppBuildLabel(buildInfo)}</dd>
        </div>
      </dl>
      <BackupPanel data={data} onDataStateChange={onDataStateChange} />
      {showReset ? (
        <WorkspaceStatusCard
          data={data}
          onDataStateChange={onDataStateChange}
          showReset={showReset}
        />
      ) : null}
    </section>
  );
}
