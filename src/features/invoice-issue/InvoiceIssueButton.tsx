import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { Invoice } from "../../domain";
import { issueSalesInvoice } from "../../services/invoice-workflow";

export function InvoiceIssueButton({
  invoice
}: {
  invoice: Invoice;
}) {
  const router = useRouter();
  const [actionState, setActionState] = useState<"idle" | "issuing">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (invoice.status !== "draft") {
    return null;
  }

  async function handleIssueInvoice() {
    setActionState("issuing");
    setErrorMessage(null);

    try {
      await issueSalesInvoice(invoice.id);
      await router.invalidate();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Invoice was not issued.");
    } finally {
      setActionState("idle");
    }
  }

  return (
    <>
      <button
        className="primary-button"
        type="button"
        disabled={actionState !== "idle"}
        onClick={() => void handleIssueInvoice()}
      >
        {actionState === "issuing" ? "Issuing invoice" : "Issue invoice"}
      </button>
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </>
  );
}
