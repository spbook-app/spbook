import { useMemo } from "react";
import { useParams } from "@tanstack/react-router";
import {
  JournalEntriesView,
  type AccountingRoute
} from "../../widgets/accounting/AccountingView";
import { useWorkspaceData } from "../../app/WorkspaceDataContext";

export function AccountingJournalPage() {
  return <AccountingJournalPageContent route={{ mode: "journal-list" }} />;
}

export function JournalEntryDetailPage() {
  const { journalEntryId } = useParams({ strict: false }) as { journalEntryId: string };

  return <AccountingJournalPageContent route={{ mode: "journal-detail", journalEntryId }} />;
}

export function JournalEntryEditPage() {
  const { journalEntryId } = useParams({ strict: false }) as { journalEntryId: string };

  return <AccountingJournalPageContent route={{ mode: "journal-edit", journalEntryId }} />;
}

function AccountingJournalPageContent({
  route
}: {
  route: Extract<
    AccountingRoute,
    { mode: "journal-list" | "journal-detail" | "journal-edit" }
  >;
}) {
  const { data, onWorkspaceUpdate } = useWorkspaceData();
  const accountNames = useMemo(
    () => new Map(data.accounts.map((account) => [account.code, account.name])),
    [data.accounts]
  );

  return (
    <div className="section-stack">
      <JournalEntriesView
        workspace={data.workspace}
        accounts={data.accounts}
        journalEntries={data.journalEntries}
        balances={data.balances}
        parties={data.parties}
        invoices={data.invoices}
        supplierInvoices={data.supplierInvoices}
        bankAccounts={data.bankAccounts}
        accountNames={accountNames}
        onWorkspaceUpdate={onWorkspaceUpdate}
        route={route}
      />
    </div>
  );
}
