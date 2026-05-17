import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { Account, AccountRole } from "../../domain";
import { createWorkspaceAccount } from "../../services/account-workflow";
import type { AppDataState, ReadyWorkspaceData } from "../../shared/model/workspace";
import { mapOverviewToReadyState } from "../../shared/lib/workspace-overview";

type ReadyAppData = ReadyWorkspaceData;

function AccountCreateFields({
  code,
  currency,
  groupAccounts,
  name,
  parentCode,
  role,
  onCodeChange,
  onCurrencyChange,
  onNameChange,
  onParentCodeChange,
  onRoleChange
}: {
  code: string;
  currency: string;
  groupAccounts: Account[];
  name: string;
  parentCode: string;
  role: AccountRole;
  onCodeChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onParentCodeChange: (value: string) => void;
  onRoleChange: (value: AccountRole) => void;
}) {
  return (
    <>
      <div className="form-row">
        <label>
          <span>Code</span>
          <input value={code} onChange={(event) => onCodeChange(event.target.value)} />
        </label>
        <label>
          <span>Name</span>
          <input value={name} onChange={(event) => onNameChange(event.target.value)} />
        </label>
      </div>
      <div className="form-row">
        <label>
          <span>Role</span>
          <select value={role} onChange={(event) => onRoleChange(event.target.value as AccountRole)}>
            <option value="posting">Posting</option>
            <option value="group">Group</option>
          </select>
        </label>
        <label>
          <span>Parent group</span>
          <select
            value={parentCode}
            disabled={role !== "posting"}
            onChange={(event) => onParentCodeChange(event.target.value)}
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
          onChange={(event) => onCurrencyChange(event.target.value)}
        />
      </label>
    </>
  );
}

export function AccountCreateForm({
  data,
  onDataStateChange
}: {
  data: ReadyAppData;
  onDataStateChange: (state: AppDataState) => void;
}) {
  const navigate = useNavigate();
  const groupAccounts = data.accounts.filter((account) => account.role === "group");
  const [code, setCode] = useState("1101");
  const [name, setName] = useState("Second bank account");
  const [role, setRole] = useState<AccountRole>("posting");
  const [parentCode, setParentCode] = useState("11");
  const [currency, setCurrency] = useState(data.workspace.baseCurrency);
  const [actionState, setActionState] = useState<"idle" | "creating">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      const createdAccount = overview.accounts.find((account) => account.code === code.trim());

      onDataStateChange({ ...data, ...mapOverviewToReadyState(overview) });

      if (createdAccount) {
        void navigate({
          to: "/workspace/accounting/chart/$accountId",
          params: { accountId: createdAccount.id }
        });
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Account was not created.");
    } finally {
      setActionState("idle");
    }
  }

  return (
    <section className="panel panel-wide" aria-labelledby="account-create-title">
      <div className="panel-header">
        <h2 id="account-create-title">Create account</h2>
        <Link className="secondary-button" to="/workspace/accounting/chart">
          Back to chart
        </Link>
      </div>
      <form className="invoice-form" onSubmit={(event) => void handleCreateAccount(event)}>
        <AccountCreateFields
          code={code}
          currency={currency}
          groupAccounts={groupAccounts}
          name={name}
          parentCode={parentCode}
          role={role}
          onCodeChange={setCode}
          onCurrencyChange={setCurrency}
          onNameChange={setName}
          onParentCodeChange={setParentCode}
          onRoleChange={setRole}
        />
        <button className="primary-button" type="submit" disabled={actionState !== "idle"}>
          {actionState === "creating" ? "Creating" : "Create account"}
        </button>
      </form>
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </section>
  );
}
