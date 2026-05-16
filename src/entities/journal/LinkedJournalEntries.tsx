import type { JournalEntry } from "../../domain";
import { Link } from "@tanstack/react-router";

export function LinkedJournalEntries({ entries }: { entries: JournalEntry[] }) {
  return (
    <div className="linked-entries">
      <strong>Linked journal entries</strong>
      {entries.length === 0 ? <p className="empty-state">No linked entries yet.</p> : null}
      {entries.map((entry) => (
        <Link
          className="linked-entry"
          key={entry.id}
          to="/workspace/accounting/journal-entries/$journalEntryId"
          params={{ journalEntryId: entry.id }}
        >
          <span>{entry.description}</span>
          <small>
            {entry.entryDate} · {entry.lines.length} lines
          </small>
        </Link>
      ))}
    </div>
  );
}
