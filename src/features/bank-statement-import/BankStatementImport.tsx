import { useState, type ChangeEvent } from "react";
import type { BankAccount } from "../../domain";
import type { WorkspaceUpdateHandler } from "../../shared/model/workspace";
import {
  autoLinkImportedBankTransactions,
  importCamt053BankTransactions
} from "../../services/camt053-import";

export function BankStatementImport({
  bankAccounts,
  onWorkspaceUpdate,
  workspaceId
}: {
  bankAccounts: BankAccount[];
  onWorkspaceUpdate: WorkspaceUpdateHandler;
  workspaceId: string;
}) {
  const activeBankAccounts = bankAccounts.filter((bankAccount) => bankAccount.active);
  const [bankAccountId, setBankAccountId] = useState(bankAccounts[0]?.id ?? "");
  const [actionState, setActionState] = useState<"idle" | "importing" | "auto-link">("idle");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedBankAccountId = bankAccountId || bankAccounts[0]?.id || "";

  async function handleImportStatement(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);

    if (files.length === 0) return;

    setActionState("importing");
    setErrorMessage(null);
    setImportMessage(null);

    try {
      if (!selectedBankAccountId) {
        throw new Error("Create or select a bank account first.");
      }

      let nextUpdate = null;
      let importedCount = 0;
      let skippedCount = 0;
      const failedFiles: string[] = [];

      for (const file of files) {
        try {
          const result = await importCamt053BankTransactions({
            workspaceId,
            bankAccountId: selectedBankAccountId,
            xml: await file.text()
          });

          nextUpdate = result.bankingSlice;
          importedCount += result.importedCount;
          skippedCount += result.skippedCount;
        } catch {
          failedFiles.push(file.name);
        }
      }

      if (!nextUpdate) {
        throw new Error("No selected bank statements could be imported.");
      }

      onWorkspaceUpdate(nextUpdate);
      setImportMessage(
        `Imported ${importedCount} transactions, skipped ${skippedCount} duplicates from ${files.length - failedFiles.length} files.`
      );

      if (failedFiles.length > 0) {
        setErrorMessage(`Some files were not imported: ${failedFiles.join(", ")}.`);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Bank statement was not imported."
      );
    } finally {
      event.currentTarget.value = "";
      setActionState("idle");
    }
  }

  async function handleAutoLinkImportedTransactions() {
    setActionState("auto-link");
    setErrorMessage(null);
    setImportMessage(null);

    try {
      const result = await autoLinkImportedBankTransactions(workspaceId);

      onWorkspaceUpdate(result.bankingSlice);
      setImportMessage(`Linked ${result.linkedCount} imported transactions.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Imported transactions were not auto-linked."
      );
    } finally {
      setActionState("idle");
    }
  }

  return (
    <div className="banking-section">
      <div className="subsection-header">
        <div>
          <h3>Statement import</h3>
          <p>Import ISO 20022 CAMT.053 XML statements into the selected bank account.</p>
        </div>
      </div>

      <div className="statement-import-row">
        <label>
          <span>Bank account</span>
          <select
            value={selectedBankAccountId}
            onChange={(event) => setBankAccountId(event.target.value)}
          >
            <option value="">Select bank account</option>
            {activeBankAccounts.map((bankAccount) => (
              <option key={bankAccount.id} value={bankAccount.id}>
                {bankAccount.name} · {bankAccount.accountCode}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>CAMT.053 XML</span>
          <input
            accept=".xml,application/xml,text/xml"
            disabled={actionState !== "idle" || !selectedBankAccountId}
            multiple
            type="file"
            onChange={(event) => void handleImportStatement(event)}
          />
        </label>
      </div>
      {actionState === "importing" ? (
        <p className="field-note">Importing bank statement.</p>
      ) : null}
      <button
        className="secondary-button"
        type="button"
        disabled={actionState !== "idle"}
        onClick={() => void handleAutoLinkImportedTransactions()}
      >
        {actionState === "auto-link" ? "Auto-linking" : "Auto-link imported transactions"}
      </button>
      {importMessage ? <p className="field-note">{importMessage}</p> : null}
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </div>
  );
}
