import { useState, type ChangeEvent } from "react";
import type { AppDataState } from "../../app/App";
import {
  exportWorkspaceBackup,
  importWorkspaceBackup,
  parseWorkspaceBackup
} from "../../services/workspace-backup";
import { mapOverviewToReadyState } from "../../shared/lib/workspace-overview";

export function BackupPanel({
  data,
  onDataStateChange
}: {
  data: Extract<AppDataState, { state: "ready" }>;
  onDataStateChange: (state: AppDataState) => void;
}) {
  const [backupState, setBackupState] = useState<"idle" | "exporting" | "importing">("idle");
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  async function handleExportBackup() {
    setBackupState("exporting");
    setBackupMessage(null);
    setBackupError(null);

    try {
      const backup = await exportWorkspaceBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json"
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `spbook-backup-${data.workspace.id}-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setBackupMessage("Backup exported.");
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : "Backup was not exported.");
    } finally {
      setBackupState("idle");
    }
  }

  async function handleImportBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];

    if (!file) return;

    setBackupState("importing");
    setBackupMessage(null);
    setBackupError(null);

    try {
      const backup = parseWorkspaceBackup(await file.text());
      const overview = await importWorkspaceBackup(backup);
      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview),
        initializedWorkspace: false
      });
      setBackupMessage("Backup imported.");
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : "Backup was not imported.");
    } finally {
      event.currentTarget.value = "";
      setBackupState("idle");
    }
  }

  return (
    <div className="settings-actions">
      <button
        className="primary-button"
        type="button"
        disabled={backupState !== "idle"}
        onClick={() => void handleExportBackup()}
      >
        {backupState === "exporting" ? "Exporting" : "Export backup"}
      </button>
      <label className="file-action">
        <span>Import backup</span>
        <input
          accept="application/json,.json"
          disabled={backupState !== "idle"}
          type="file"
          onChange={(event) => void handleImportBackup(event)}
        />
      </label>
      {backupMessage ? <p className="field-note">{backupMessage}</p> : null}
      {backupError ? <p className="form-error">{backupError}</p> : null}
    </div>
  );
}
