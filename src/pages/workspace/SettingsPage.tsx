import { SettingsPanel } from "../../widgets/settings/SettingsPanel";
import { workspaceRoute } from "../../app/router";
import { getAppEnvironment, shouldShowEnvironmentBadge } from "../../app/app-env";

export function SettingsPage() {
  const { workspace, accounts, initializedWorkspace } = workspaceRoute.useLoaderData();
  const showReset = shouldShowEnvironmentBadge(getAppEnvironment());

  return (
    <SettingsPanel
      workspace={workspace}
      accounts={accounts}
      initializedWorkspace={initializedWorkspace}
      showReset={showReset}
    />
  );
}
