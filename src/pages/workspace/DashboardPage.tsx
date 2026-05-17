import { useMemo } from "react";
import { DashboardView } from "../../widgets/dashboard/DashboardView";
import { useWorkspaceData } from "../../app/WorkspaceDataContext";

export function DashboardPage() {
  const { data } = useWorkspaceData();
  const accountNames = useMemo(
    () => new Map(data.accounts.map((account) => [account.code, account.name])),
    [data.accounts]
  );

  return <DashboardView data={data} accountNames={accountNames} />;
}
