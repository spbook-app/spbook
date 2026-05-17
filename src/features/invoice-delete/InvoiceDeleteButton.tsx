import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Invoice } from "../../domain";
import { deleteSalesInvoice } from "../../services/invoice-workflow";
import type { WorkspaceUpdateHandler } from "../../shared/model/workspace";

export function InvoiceDeleteButton({
  invoice,
  onWorkspaceUpdate
}: {
  invoice: Invoice;
  onWorkspaceUpdate: WorkspaceUpdateHandler;
}) {
  const navigate = useNavigate();
  const [actionState, setActionState] = useState<"idle" | "deleting">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDeleteInvoice() {
    setActionState("deleting");
    setErrorMessage(null);

    try {
      const update = await deleteSalesInvoice(invoice.id);

      onWorkspaceUpdate(update);
      void navigate({ to: "/workspace/sales/invoices" });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Invoice was not deleted.");
    } finally {
      setActionState("idle");
    }
  }

  if (invoice.status === "paid") {
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
