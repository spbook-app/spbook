import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import type { Account, JournalEntry, JournalLineSide } from "../../domain";
import { addMinorUnits, compareMinorUnits, parseMoneyAmount } from "../../domain/money";
import { updateJournalEntry } from "../../services/journal-workflow";

type JournalLineEdit = {
  side: JournalLineSide;
  accountCode: string;
  amount: string;
  currency: string;
  partyId?: string;
  invoiceId?: string;
  supplierInvoiceId?: string;
  bankAccountId?: string;
  taxPeriod?: string;
};

function formatMinorUnits(minorUnits: bigint): string {
  const whole = minorUnits / 100n;
  const fraction = (minorUnits % 100n).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

export function JournalEntryEditForm({
  entry,
  accounts,
  baseCurrency
}: {
  entry: JournalEntry;
  accounts: Account[];
  baseCurrency: string;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const postingAccounts = accounts.filter((a) => a.role === "posting");
  const [editDescription, setEditDescription] = useState(entry.description);
  const [editDate, setEditDate] = useState(entry.entryDate);
  const [editLines, setEditLines] = useState<JournalLineEdit[]>(() =>
    entry.lines.map((line) => ({ ...line }))
  );
  const [actionState, setActionState] = useState<"idle" | "saving">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const debitTotal = addMinorUnits(
    editLines
      .filter((l) => l.side === "debit")
      .map((l) => parseMoneyAmount(l.amount))
      .filter((r): r is { ok: true; minorUnits: bigint } => r.ok)
      .map((r) => r.minorUnits)
  );
  const creditTotal = addMinorUnits(
    editLines
      .filter((l) => l.side === "credit")
      .map((l) => parseMoneyAmount(l.amount))
      .filter((r): r is { ok: true; minorUnits: bigint } => r.ok)
      .map((r) => r.minorUnits)
  );
  const isBalanced = compareMinorUnits(debitTotal, creditTotal) === 0;

  useEffect(() => {
    setEditDescription(entry.description);
    setEditDate(entry.entryDate);
    setEditLines(entry.lines.map((line) => ({ ...line })));
  }, [entry]);

  function handleAddLine() {
    setEditLines((prev) => [
      ...prev,
      {
        side: "debit",
        accountCode: postingAccounts[0]?.code ?? "",
        amount: "0.00",
        currency: baseCurrency
      }
    ]);
  }

  function handleRemoveLine(index: number) {
    setEditLines((prev) => prev.filter((_, i) => i !== index));
  }

  function handleLineChange(index: number, patch: Partial<JournalLineEdit>) {
    setEditLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setActionState("saving");

    try {
      const update = await updateJournalEntry({
        journalEntryId: entry.id,
        description: editDescription,
        entryDate: editDate,
        lines: editLines
      });

      await router.invalidate();
      void navigate({
        to: "/workspace/accounting/journal-entries/$journalEntryId",
        params: { journalEntryId: entry.id }
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Journal entry was not saved.");
    } finally {
      setActionState("idle");
    }
  }

  return (
    <form className="invoice-form" onSubmit={(event) => void handleSave(event)}>
      <div className="form-row">
        <label>
          <span>Description</span>
          <input
            value={editDescription}
            onChange={(event) => setEditDescription(event.target.value)}
          />
        </label>
        <label>
          <span>Entry date</span>
          <input
            type="date"
            value={editDate}
            onChange={(event) => setEditDate(event.target.value)}
          />
        </label>
      </div>
      <div className="je-lines-editor">
        {editLines.map((line, index) => (
          <div className="je-line-row" key={index}>
            <label className="je-line-side">
              <span>Side</span>
              <select
                value={line.side}
                onChange={(event) =>
                  handleLineChange(index, { side: event.target.value as JournalLineSide })
                }
              >
                <option value="debit">Dr</option>
                <option value="credit">Cr</option>
              </select>
            </label>
            <label className="je-line-account">
              <span>Account</span>
              <select
                value={line.accountCode}
                onChange={(event) =>
                  handleLineChange(index, { accountCode: event.target.value })
                }
              >
                {postingAccounts.map((account) => (
                  <option key={account.id} value={account.code}>
                    {account.code} · {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="je-line-amount">
              <span>Amount</span>
              <input
                value={line.amount}
                onChange={(event) => handleLineChange(index, { amount: event.target.value })}
              />
            </label>
            <label className="je-line-currency">
              <span>Currency</span>
              <input
                value={line.currency}
                onChange={(event) =>
                  handleLineChange(index, { currency: event.target.value })
                }
              />
            </label>
            <div className="je-line-remove">
              <span> </span>
              <button
                type="button"
                className="secondary-button"
                onClick={() => handleRemoveLine(index)}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        <button type="button" className="secondary-button" onClick={handleAddLine}>
          Add line
        </button>
      </div>
      <div className="je-balance-status">
        <span>
          Dr total: <strong>{formatMinorUnits(debitTotal)}</strong>
        </span>
        <span>
          Cr total: <strong>{formatMinorUnits(creditTotal)}</strong>
        </span>
        {isBalanced ? (
          <span className="je-balanced">Balanced</span>
        ) : (
          <span className="je-unbalanced">Not balanced</span>
        )}
      </div>
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
      <div className="transaction-detail-actions">
        <button
          className="primary-button"
          type="submit"
          disabled={actionState !== "idle" || !isBalanced}
        >
          {actionState === "saving" ? "Saving" : "Save entry"}
        </button>
        <Link
          className="secondary-button"
          to="/workspace/accounting/journal-entries/$journalEntryId"
          params={{ journalEntryId: entry.id }}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
