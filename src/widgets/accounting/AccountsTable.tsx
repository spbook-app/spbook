import { useEffect, useState, type FormEvent } from "react";
import type { AccountRole } from "../../domain";
import { createWorkspaceAccount, updateWorkspaceAccount } from "../../services/account-workflow";
import { mapOverviewToReadyState } from "../../shared/lib/workspace-overview";
import type { AppDataState } from "../../app/App";

export function AccountsTable({
  data,
  onDataStateChange
}: {
  data: Extract<AppDataState, { state: "ready" }>;
  onDataStateChange: (state: AppDataState) => void;
}) {
  const accounts = data.accounts;
  const groupAccounts = accounts.filter((account) => account.role === "group");
  const [code, setCode] = useState("1101");
  const [name, setName] = useState("Second bank account");
  const [role, setRole] = useState<AccountRole>("posting");
  const [parentCode, setParentCode] = useState("11");
  const [currency, setCurrency] = useState(data.workspace.baseCurrency);
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id ?? "");
  const selectedAccount =
    accounts.find((account) => account.id === selectedAccountId) ?? accounts[0] ?? null;
  const [editName, setEditName] = useState(selectedAccount?.name ?? "");
  const [editParentCode, setEditParentCode] = useState(selectedAccount?.parentCode ?? "");
  const [editCurrency, setEditCurrency] = useState(selectedAccount?.currency ?? "");
  const [editActive, setEditActive] = useState(selectedAccount?.active ?? true);
  const [actionState, setActionState] = useState<"idle" | "creating" | "updating">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAccount) return;

    setSelectedAccountId(selectedAccount.id);
    setEditName(selectedAccount.name);
    setEditParentCode(selectedAccount.parentCode ?? "");
    setEditCurrency(selectedAccount.currency ?? "");
    setEditActive(selectedAccount.active);
  }, [selectedAccount]);

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setActionState("creating");

    try {
      const overview = await createWorkspaceAccount({
        workspaceId: data.workspace.id,
        code,
        name,
        role,
        parentCode: role === "posting" ? parentCode : undefined,
        currency: role === "posting" ? currency : undefined
      });

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedAccountId(overview.accounts.find((account) => account.code === code)?.id ?? "");
      setCode("");
      setName("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Account was not created.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleUpdateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setActionState("updating");

    try {
      if (!selectedAccount) {
        throw new Error("Select an account first.");
      }

      const overview = await updateWorkspaceAccount({
        accountId: selectedAccount.id,
        name: editName,
        parentCode: selectedAccount.role === "posting" ? editParentCode : undefined,
        currency: selectedAccount.role === "posting" ? editCurrency : undefined,
        active: editActive
      });

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Account was not updated.");
    } finally {
      setActionState("idle");
    }
  }

  return (
    <section className="panel panel-wide" aria-labelledby="accounts-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Chart</p>
          <h2 id="accounts-title">Workspace accounts</h2>
        </div>
        <span>{accounts.length} accounts</span>
      </div>
      <form className="invoice-form" onSubmit={(event) => void handleCreateAccount(event)}>
        <div className="form-row">
          <label>
            <span>Code</span>
            <input value={code} onChange={(event) => setCode(event.target.value)} />
          </label>
          <label>
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
        </div>
        <div className="form-row">
          <label>
            <span>Role</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as AccountRole)}
            >
              <option value="posting">Posting</option>
              <option value="group">Group</option>
            </select>
          </label>
          <label>
            <span>Parent group</span>
            <select
              value={parentCode}
              disabled={role !== "posting"}
              onChange={(event) => setParentCode(event.target.value)}
            >
              <option value="">No parent</option>
              {groupAccounts.map((account) => (
                <option key={account.id} value={account.code}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          <span>Currency</span>
          <input
            disabled={role !== "posting"}
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
          />
        </label>
        <button className="primary-button" type="submit" disabled={actionState !== "idle"}>
          {actionState === "creating" ? "Creating" : "Create account"}
        </button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Role</th>
              <th>Currency</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr
                className={selectedAccount?.id === account.id ? "selected-row" : ""}
                key={account.id}
                onClick={() => setSelectedAccountId(account.id)}
              >
                <td className="code-cell">{account.code}</td>
                <td>{account.name}</td>
                <td>
                  <span className={`role-pill role-${account.role}`}>{account.role}</span>
                </td>
                <td>{account.currency ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedAccount ? (
        <form
          className="invoice-form edit-bank-account-form"
          onSubmit={(event) => void handleUpdateAccount(event)}
        >
          <div className="form-row">
            <label>
              <span>Code</span>
              <input disabled value={selectedAccount.code} />
            </label>
            <label>
              <span>Role</span>
              <input disabled value={selectedAccount.role} />
            </label>
          </div>
          <label>
            <span>Edit name</span>
            <input value={editName} onChange={(event) => setEditName(event.target.value)} />
          </label>
          <div className="form-row">
            <label>
              <span>Edit parent group</span>
              <select
                value={editParentCode}
                disabled={selectedAccount.role !== "posting"}
                onChange={(event) => setEditParentCode(event.target.value)}
              >
                <option value="">No parent</option>
                {groupAccounts.map((account) => (
                  <option key={account.id} value={account.code}>
                    {account.code} · {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Edit currency</span>
              <input
                disabled={selectedAccount.role !== "posting"}
                value={editCurrency}
                onChange={(event) => setEditCurrency(event.target.value)}
              />
            </label>
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={editActive}
              onChange={(event) => setEditActive(event.target.checked)}
            />
            <span>Active account</span>
          </label>
          <p className="field-note">
            Account code and role are fixed after creation because journal entries refer to
            account codes.
          </p>
          <button className="secondary-button" type="submit" disabled={actionState !== "idle"}>
            {actionState === "updating" ? "Saving" : "Save account"}
          </button>
        </form>
      ) : null}
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </section>
  );
}
