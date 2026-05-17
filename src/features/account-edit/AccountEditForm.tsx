import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import type { Account } from "../../domain";
import { updateWorkspaceAccount } from "../../services/account-workflow";

function AccountEditFields({
  account,
  active,
  currency,
  groupAccounts,
  name,
  parentCode,
  onActiveChange,
  onCurrencyChange,
  onNameChange,
  onParentCodeChange
}: {
  account: Account;
  active: boolean;
  currency: string;
  groupAccounts: Account[];
  name: string;
  parentCode: string;
  onActiveChange: (value: boolean) => void;
  onCurrencyChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onParentCodeChange: (value: string) => void;
}) {
  return (
    <>
      <div className="form-row">
        <label>
          <span>Code</span>
          <input disabled value={account.code} />
        </label>
        <label>
          <span>Role</span>
          <input disabled value={account.role} />
        </label>
      </div>
      <label>
        <span>Name</span>
        <input value={name} onChange={(event) => onNameChange(event.target.value)} />
      </label>
      <div className="form-row">
        <label>
          <span>Parent group</span>
          <select
            value={parentCode}
            disabled={account.role !== "posting"}
            onChange={(event) => onParentCodeChange(event.target.value)}
          >
            <option value="">No parent</option>
            {groupAccounts.map((groupAccount) => (
              <option key={groupAccount.id} value={groupAccount.code}>
                {groupAccount.code} · {groupAccount.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Currency</span>
          <input
            disabled={account.role !== "posting"}
            value={currency}
            onChange={(event) => onCurrencyChange(event.target.value)}
          />
        </label>
      </div>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={active}
          onChange={(event) => onActiveChange(event.target.checked)}
        />
        <span>Active account</span>
      </label>
    </>
  );
}

export function AccountEditForm({
  account,
  accounts
}: {
  account: Account;
  accounts: Account[];
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const groupAccounts = accounts.filter(
    (candidate) => candidate.role === "group" && candidate.id !== account.id
  );
  const [editName, setEditName] = useState(account.name);
  const [editParentCode, setEditParentCode] = useState(account.parentCode ?? "");
  const [editCurrency, setEditCurrency] = useState(account.currency ?? "");
  const [editActive, setEditActive] = useState(account.active);
  const [actionState, setActionState] = useState<"idle" | "updating">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setEditName(account.name);
    setEditParentCode(account.parentCode ?? "");
    setEditCurrency(account.currency ?? "");
    setEditActive(account.active);
  }, [account]);

  async function handleUpdateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setActionState("updating");

    try {
      const update = await updateWorkspaceAccount({
        accountId: account.id,
        name: editName,
        parentCode: account.role === "posting" ? editParentCode : undefined,
        currency: account.role === "posting" ? editCurrency : undefined,
        active: editActive
      });

      await router.invalidate();
      void navigate({
        to: "/workspace/accounting/chart/$accountId",
        params: { accountId: account.id }
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Account was not updated.");
    } finally {
      setActionState("idle");
    }
  }

  return (
    <form className="invoice-form" onSubmit={(event) => void handleUpdateAccount(event)}>
      <AccountEditFields
        account={account}
        active={editActive}
        currency={editCurrency}
        groupAccounts={groupAccounts}
        name={editName}
        parentCode={editParentCode}
        onActiveChange={setEditActive}
        onCurrencyChange={setEditCurrency}
        onNameChange={setEditName}
        onParentCodeChange={setEditParentCode}
      />
      <p className="field-note">
        Account code and role are fixed after creation because journal entries refer to
        account codes.
      </p>
      <div className="transaction-detail-actions">
        <button className="primary-button" type="submit" disabled={actionState !== "idle"}>
          {actionState === "updating" ? "Saving" : "Save account"}
        </button>
        <Link
          className="secondary-button"
          to="/workspace/accounting/chart/$accountId"
          params={{ accountId: account.id }}
        >
          Cancel
        </Link>
      </div>
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </form>
  );
}
