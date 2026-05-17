import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { Party } from "../../domain";
import { SupplierInvoiceEditableFields } from "../../entities/supplier-invoice/SupplierInvoiceFields";
import { createSupplierInvoice } from "../../services/supplier-invoice-workflow";
import type { WorkspaceUpdateHandler } from "../../shared/model/workspace";

export function SupplierInvoiceCreateForm({
  baseCurrency,
  onWorkspaceUpdate,
  supplierParties,
  workspaceId
}: {
  baseCurrency: string;
  onWorkspaceUpdate: WorkspaceUpdateHandler;
  supplierParties: Party[];
  workspaceId: string;
}) {
  const navigate = useNavigate();
  const [partyId, setPartyId] = useState(supplierParties[0]?.id ?? "");
  const [number, setNumber] = useState("SI-2026-001");
  const [issueDate, setIssueDate] = useState("2026-05-10");
  const [total, setTotal] = useState("1000.00");
  const [expenseAccountCode, setExpenseAccountCode] = useState("401");
  const [actionState, setActionState] = useState<"idle" | "saving">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCreateSupplierInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionState("saving");
    setErrorMessage(null);

    try {
      if (!partyId) {
        throw new Error("Select a supplier counterparty first.");
      }

      const update = await createSupplierInvoice({
        workspaceId,
        partyId,
        number,
        issueDate,
        total,
        expenseAccountCode,
        currency: baseCurrency
      });
      const createdInvoice = update.supplierInvoice;

      onWorkspaceUpdate(update);

      if (createdInvoice) {
        void navigate({
          to: "/workspace/purchases/supplier-invoices/$supplierInvoiceId",
          params: { supplierInvoiceId: createdInvoice.id }
        });
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Supplier invoice was not created."
      );
    } finally {
      setActionState("idle");
    }
  }

  return (
    <section className="panel" aria-labelledby="create-supplier-invoice-title">
      <div className="panel-header">
        <h2 id="create-supplier-invoice-title">Create supplier invoice</h2>
        <Link className="secondary-button" to="/workspace/purchases/supplier-invoices">
          Back to list
        </Link>
      </div>

      <form
        className="invoice-form"
        onSubmit={(event) => void handleCreateSupplierInvoice(event)}
      >
        <SupplierInvoiceEditableFields
          currency={baseCurrency}
          expenseAccountCode={expenseAccountCode}
          issueDate={issueDate}
          number={number}
          partyId={partyId}
          supplierParties={supplierParties}
          total={total}
          onExpenseAccountCodeChange={setExpenseAccountCode}
          onIssueDateChange={setIssueDate}
          onNumberChange={setNumber}
          onPartyIdChange={setPartyId}
          onTotalChange={setTotal}
        />
        <button className="primary-button" type="submit" disabled={actionState !== "idle"}>
          {actionState === "saving" ? "Creating" : "Create supplier invoice"}
        </button>
      </form>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </section>
  );
}
