import { SettingsPanel } from "../../widgets/settings/SettingsPanel";
import { useWorkspaceData } from "../../app/WorkspaceDataContext";

export function SettingsPage() {
  const { data, onDataStateChange, showReset } = useWorkspaceData();

  return (
    <SettingsPanel
      workspace={data.workspace}
      accounts={data.accounts}
      initializedWorkspace={data.initializedWorkspace}
      onDataStateChange={onDataStateChange}
      showReset={showReset}
    />
  );
}
