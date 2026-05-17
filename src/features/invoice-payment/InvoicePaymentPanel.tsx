import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { BankTransaction, Invoice } from "../../domain";
import { LinkedBankTransactionSummary } from "../../entities/bank-transaction/LinkedBankTransactionSummary";
import {
  matchInvoicePaymentFromBankTransaction,
  undoBankTransactionPosting
} from "../../services/bank-workflow";

export function InvoicePaymentPanel({
  bankTransactions,
  invoice
}: {
  bankTransactions: BankTransaction[];
  invoice: Invoice;
}) {
  const router = useRouter();
  const [selectedPaymentBankTransactionId, setSelectedPaymentBankTransactionId] =
    useState("");
  const [actionState, setActionState] = useState<"idle" | "paying" | "undo">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const linkedInvoiceBankTransaction =
    bankTransactions.find(
      (bankTransaction) =>
        bankTransaction.matchedDocumentType === "invoice" &&
        bankTransaction.matchedDocumentId === invoice.id
    ) ?? null;
  const paymentCandidates = getIncomingPaymentCandidates(bankTransactions, invoice);
  const selectedIncomingBankTransactionId =
    selectedPaymentBankTransactionId || paymentCandidates[0]?.id || "";

  async function handleRecordPayment() {
    setActionState("paying");
    setErrorMessage(null);

    try {
      if (!selectedIncomingBankTransactionId) {
        throw new Error("Select an incoming bank transaction first.");
      }

      const update = await matchInvoicePaymentFromBankTransaction(
        invoice.id,
        selectedIncomingBankTransactionId
      );

      await router.invalidate();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Payment was not recorded.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleUndoPayment() {
    if (!linkedInvoiceBankTransaction) return;

    setActionState("undo");
    setErrorMessage(null);

    try {
      const update = await undoBankTransactionPosting(linkedInvoiceBankTransaction.id);

      await router.invalidate();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Payment was not undone.");
    } finally {
      setActionState("idle");
    }
  }

  return (
    <>
      {linkedInvoiceBankTransaction ? (
        <LinkedBankTransactionSummary
          label="Linked incoming bank transaction"
          bankTransaction={linkedInvoiceBankTransaction}
          onUndo={() => void handleUndoPayment()}
          undoDisabled={actionState !== "idle"}
          undoLabel={actionState === "undo" ? "Undoing payment" : "Undo payment"}
        />
      ) : (
        <>
          <label className="inline-select">
            <span>Incoming bank transaction</span>
            <select
              value={selectedIncomingBankTransactionId}
              onChange={(event) => setSelectedPaymentBankTransactionId(event.target.value)}
            >
              <option value="">Select transaction</option>
              {paymentCandidates.map((bankTransaction) => (
                <option key={bankTransaction.id} value={bankTransaction.id}>
                  {bankTransaction.bookingDate} · {bankTransaction.amount} ·{" "}
                  {bankTransaction.description}
                </option>
              ))}
            </select>
          </label>
          <button
            className="secondary-button"
            type="button"
            disabled={actionState !== "idle" || invoice.status === "paid"}
            onClick={() => void handleRecordPayment()}
          >
            {invoice.status === "paid" ? "Payment recorded" : "Record payment"}
          </button>
        </>
      )}
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </>
  );
}

function getIncomingPaymentCandidates(bankTransactions: BankTransaction[], invoice: Invoice) {
  return bankTransactions
    .filter(
      (bankTransaction) =>
        bankTransaction.status === "unmatched" && !bankTransaction.amount.startsWith("-")
    )
    .sort((left, right) => {
      const leftScore = getPaymentCandidateScore(left, invoice);
      const rightScore = getPaymentCandidateScore(right, invoice);

      return rightScore - leftScore;
    });
}

function getPaymentCandidateScore(bankTransaction: BankTransaction, invoice: Invoice) {
  let score = 0;

  if (bankTransaction.partyId === invoice.partyId) {
    score += 2;
  }

  if (Number(bankTransaction.amount) === Number(invoice.total)) {
    score += 1;
  }

  return score;
}
