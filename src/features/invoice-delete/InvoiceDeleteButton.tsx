import { useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import type { Invoice } from "../../domain";
import { deleteSalesInvoice } from "../../services/invoice-workflow";

export function InvoiceDeleteButton({
  invoice
}: {
  invoice: Invoice;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const [actionState, setActionState] = useState<"idle" | "deleting">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDeleteInvoice() {
    setActionState("deleting");
    setErrorMessage(null);

    try {
      await deleteSalesInvoice(invoice.id);

      await router.invalidate();
      void navigate({ to: "/workspace/sales/invoices" });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Invoice was not deleted.");
    } finally {
      setActionState("idle");
    }
  }

  if (invoice.status !== "draft") {
    return null;
  }

  return (
    <>
      <button
        className="secondary-button danger-button"
        type="button"
        disabled={actionState !== "idle"}
        onClick={() => void handleDeleteInvoice()}
      >
        {actionState === "deleting" ? "Deleting invoice" : "Delete invoice"}
      </button>
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </>
  );
}
