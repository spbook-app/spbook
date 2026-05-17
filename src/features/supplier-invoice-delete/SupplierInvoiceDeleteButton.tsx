import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { SupplierInvoice } from "../../domain";
import { deleteSupplierInvoice } from "../../services/supplier-invoice-workflow";
import type { WorkspaceUpdateHandler } from "../../shared/model/workspace";

export function SupplierInvoiceDeleteButton({
  onWorkspaceUpdate,
  supplierInvoice
}: {
  onWorkspaceUpdate: WorkspaceUpdateHandler;
  supplierInvoice: SupplierInvoice;
}) {
  const navigate = useNavigate();
  const [actionState, setActionState] = useState<"idle" | "deleting">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDeleteSupplierInvoice() {
    setActionState("deleting");
    setErrorMessage(null);

    try {
      const update = await deleteSupplierInvoice(supplierInvoice.id);
      onWorkspaceUpdate(update);
      void navigate({ to: "/workspace/purchases/supplier-invoices" });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Supplier invoice was not deleted."
      );
    } finally {
      setActionState("idle");
    }
  }

  if (supplierInvoice.status === "paid") {
    return null;
  }

  return (
    <>
      <button
        className="secondary-button danger-button"
        type="button"
        disabled={actionState !== "idle"}
        onClick={() => void handleDeleteSupplierInvoice()}
      >
        {actionState === "deleting" ? "Deleting invoice" : "Delete invoice"}
      </button>
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </>
  );
}
