import { useMemo } from "react";
import { JournalEntriesView } from "../../widgets/accounting/AccountingView";
import { useWorkspaceData } from "../../app/WorkspaceDataContext";

export function AccountingJournalPage() {
  const { data, onDataStateChange } = useWorkspaceData();
  const accountNames = useMemo(
    () => new Map(data.accounts.map((account) => [account.code, account.name])),
    [data.accounts]
  );

  return (
    <div className="section-stack">
      <JournalEntriesView
        accountNames={accountNames}
        data={data}
        onDataStateChange={onDataStateChange}
      />
    </div>
  );
}
