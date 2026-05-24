import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { Invoice } from "../../domain";
import { unissueSalesInvoice } from "../../services/invoice-workflow";

export function InvoiceUnissueButton({
  invoice
}: {
  invoice: Invoice;
}) {
  const router = useRouter();
  const [actionState, setActionState] = useState<"idle" | "unissuing">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (invoice.status !== "issued") {
    return null;
  }

  async function handleUnissueInvoice() {
    setActionState("unissuing");
    setErrorMessage(null);

    try {
      await unissueSalesInvoice(invoice.id);
      await router.invalidate();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Invoice was not reverted to draft.");
    } finally {
      setActionState("idle");
    }
  }

  return (
    <>
      <p className="field-note">
        Undoing issue will remove the journal entry for this invoice.
      </p>
      <button
        className="secondary-button"
        type="button"
        disabled={actionState !== "idle"}
        onClick={() => void handleUnissueInvoice()}
      >
        {actionState === "unissuing" ? "Reverting to draft" : "Undo issue"}
      </button>
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </>
  );
}
