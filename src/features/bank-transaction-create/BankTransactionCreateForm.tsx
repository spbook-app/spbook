import { useState, type FormEvent } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import type { BankAccount } from "../../domain";
import { BankTransactionEditableFields } from "../../entities/bank-transaction/BankTransactionFields";
import { createBankTransaction } from "../../services/bank-workflow";

export function BankTransactionCreateForm({
  workspace,
  bankAccounts
}: {
  workspace: { id: string; baseCurrency: string };
  bankAccounts: BankAccount[];
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const activeBankAccounts = bankAccounts.filter((bankAccount) => bankAccount.active);
  const [bankAccountId, setBankAccountId] = useState(bankAccounts[0]?.id ?? "");
  const [bookingDate, setBookingDate] = useState("2026-05-15");
  const [transactionAmount, setTransactionAmount] = useState("1000.00");
  const [description, setDescription] = useState("Bank transaction");
  const [reference, setReference] = useState("");
  const [actionState, setActionState] = useState<"idle" | "creating">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedBankAccountId = bankAccountId || bankAccounts[0]?.id || "";

  async function handleCreateBankTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionState("creating");
    setErrorMessage(null);

    try {
      if (!selectedBankAccountId) {
        throw new Error("Create a bank account first.");
      }

      const update = await createBankTransaction({
        workspaceId: workspace.id,
        bankAccountId: selectedBankAccountId,
        bookingDate,
        amount: transactionAmount,
        currency: workspace.baseCurrency,
        description,
        reference
      });
      const createdBankTransaction = update.bankTransactions?.at(-1);

      await router.invalidate();

      if (createdBankTransaction) {
        void navigate({
          to: "/workspace/banking/transactions/$bankTransactionId",
          params: { bankTransactionId: createdBankTransaction.id }
        });
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Bank transaction was not created."
      );
    } finally {
      setActionState("idle");
    }
  }

  return (
    <div className="banking-section">
      <div className="subsection-header">
        <div>
          <h3>Create bank transaction</h3>
          <p>Add a signed account movement manually.</p>
        </div>
        <Link className="secondary-button" to="/workspace/banking/transactions">
          Back to list
        </Link>
      </div>

      <form
        className="invoice-form"
        onSubmit={(event) => void handleCreateBankTransaction(event)}
      >
        <BankTransactionEditableFields
          activeBankAccounts={activeBankAccounts}
          bankAccountId={selectedBankAccountId}
          bookingDate={bookingDate}
          description={description}
          reference={reference}
          transactionAmount={transactionAmount}
          onBankAccountIdChange={setBankAccountId}
          onBookingDateChange={setBookingDate}
          onDescriptionChange={setDescription}
          onReferenceChange={setReference}
          onTransactionAmountChange={setTransactionAmount}
        />
        <button className="primary-button" type="submit" disabled={actionState !== "idle"}>
          {actionState === "creating" ? "Creating" : "Create bank transaction"}
        </button>
      </form>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </div>
  );
}
