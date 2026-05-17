import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { Party } from "../../domain";
import { SupplierInvoiceEditableFields } from "../../entities/supplier-invoice/SupplierInvoiceFields";
import { createSupplierInvoice } from "../../services/supplier-invoice-workflow";
import type { AppDataState, ReadyWorkspaceData } from "../../shared/model/workspace";
import { mapOverviewToReadyState } from "../../shared/lib/workspace-overview";

type ReadyAppData = ReadyWorkspaceData;

export function SupplierInvoiceCreateForm({
  supplierParties,
  data,
  onDataStateChange
}: {
  supplierParties: Party[];
  data: ReadyAppData;
  onDataStateChange: (state: AppDataState) => void;
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

      const overview = await createSupplierInvoice({
        workspaceId: data.workspace.id,
        partyId,
        number,
        issueDate,
        total,
        expenseAccountCode,
        currency: data.workspace.baseCurrency
      });
      const createdInvoice = overview.latestSupplierInvoice;

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });

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
          currency={data.workspace.baseCurrency}
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
