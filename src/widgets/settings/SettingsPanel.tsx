import type { SettingsPanelProps } from "../../shared/model/widget-props";
import { formatAppBuildLabel } from "../../app/app-env";
import { buildInfo } from "../../generated/build-info";
import { BackupPanel } from "../../features/backup-restore/BackupPanel";
import { WorkspaceStatusCard } from "../workspace-sidebar/WorkspaceSidebar";

export function SettingsPanel(props: SettingsPanelProps) {
  const { workspace, accounts, initializedWorkspace, showReset } = props;
  return (
    <section className="panel" aria-labelledby="settings-title">
      <div className="panel-header">
        <h2 id="settings-title">Workspace settings</h2>
      </div>
      <dl className="detail-list settings-details">
        <div>
          <dt>Workspace</dt>
          <dd>{workspace.name}</dd>
        </div>
        <div>
          <dt>Country</dt>
          <dd>{workspace.countryCode}</dd>
        </div>
        <div>
          <dt>Currency</dt>
          <dd>{workspace.baseCurrency}</dd>
        </div>
        <div>
          <dt>Storage</dt>
          <dd>{initializedWorkspace ? "Created locally" : "Loaded locally"}</dd>
        </div>
        <div>
          <dt>Build</dt>
          <dd>{formatAppBuildLabel(buildInfo)}</dd>
        </div>
      </dl>
      <BackupPanel workspace={workspace} />
      {showReset ? (
        <WorkspaceStatusCard
          workspace={workspace}
          accounts={accounts}
          initializedWorkspace={initializedWorkspace}
          showReset={showReset}
        />
      ) : null}
    </section>
  );
}
