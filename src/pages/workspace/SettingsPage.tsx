import { SettingsPanel } from "../../widgets/settings/SettingsPanel";
import { useWorkspaceData } from "../../app/WorkspaceDataContext";

export function SettingsPage() {
  const { data, onDataStateChange, showReset } = useWorkspaceData();

  return (
    <SettingsPanel data={data} onDataStateChange={onDataStateChange} showReset={showReset} />
  );
}
