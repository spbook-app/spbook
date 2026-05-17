import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { BankTransaction, SupplierInvoice } from "../../domain";
import { LinkedBankTransactionSummary } from "../../entities/bank-transaction/LinkedBankTransactionSummary";
import {
  matchSupplierPaymentFromBankTransaction,
  undoBankTransactionPosting
} from "../../services/bank-workflow";

export function SupplierInvoicePaymentPanel({
  bankTransactions,
  supplierInvoice
}: {
  bankTransactions: BankTransaction[];
  supplierInvoice: SupplierInvoice;
}) {
  const router = useRouter();
  const [selectedPaymentBankTransactionId, setSelectedPaymentBankTransactionId] =
    useState("");
  const [actionState, setActionState] = useState<"idle" | "paying" | "undo">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const linkedBankTransaction =
    bankTransactions.find(
      (bankTransaction) =>
        bankTransaction.matchedDocumentType === "supplier_invoice" &&
        bankTransaction.matchedDocumentId === supplierInvoice.id
    ) ?? null;
  const paymentCandidates = getOutgoingPaymentCandidates(bankTransactions, supplierInvoice);
  const selectedOutgoingBankTransactionId =
    selectedPaymentBankTransactionId || paymentCandidates[0]?.id || "";

  async function handleRecordPayment() {
    setActionState("paying");
    setErrorMessage(null);

    try {
      if (!selectedOutgoingBankTransactionId) {
        throw new Error("Select an outgoing bank transaction first.");
      }

      const update = await matchSupplierPaymentFromBankTransaction(
        supplierInvoice.id,
        selectedOutgoingBankTransactionId
      );

      await router.invalidate();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Supplier payment was not recorded."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleUndoPayment() {
    if (!linkedBankTransaction) return;

    setActionState("undo");
    setErrorMessage(null);

    try {
      const update = await undoBankTransactionPosting(linkedBankTransaction.id);
      await router.invalidate();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Supplier payment was not undone."
      );
    } finally {
      setActionState("idle");
    }
  }

  return (
    <>
      {linkedBankTransaction ? (
        <LinkedBankTransactionSummary
          label="Linked outgoing bank transaction"
          bankTransaction={linkedBankTransaction}
          onUndo={() => void handleUndoPayment()}
          undoDisabled={actionState !== "idle"}
          undoLabel={actionState === "undo" ? "Undoing payment" : "Undo payment"}
        />
      ) : (
        <>
          <label className="inline-select">
            <span>Outgoing bank transaction</span>
            <select
              value={selectedOutgoingBankTransactionId}
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
            disabled={actionState !== "idle" || supplierInvoice.status === "paid"}
            onClick={() => void handleRecordPayment()}
          >
            {supplierInvoice.status === "paid" ? "Payment recorded" : "Record payment"}
          </button>
        </>
      )}
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </>
  );
}

function getOutgoingPaymentCandidates(
  bankTransactions: BankTransaction[],
  supplierInvoice: SupplierInvoice
) {
  return bankTransactions
    .filter(
      (bankTransaction) =>
        bankTransaction.status === "unmatched" && bankTransaction.amount.startsWith("-")
    )
    .sort((left, right) => {
      const leftScore = getPaymentCandidateScore(left, supplierInvoice);
      const rightScore = getPaymentCandidateScore(right, supplierInvoice);

      return rightScore - leftScore;
    });
}

function getPaymentCandidateScore(
  bankTransaction: BankTransaction,
  supplierInvoice: SupplierInvoice
) {
  let score = 0;

  if (bankTransaction.partyId === supplierInvoice.partyId) {
    score += 2;
  }

  if (Number(bankTransaction.amount.replace("-", "")) === Number(supplierInvoice.total)) {
    score += 1;
  }

  return score;
}
