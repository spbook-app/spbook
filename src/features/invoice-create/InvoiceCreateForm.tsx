import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { Party } from "../../domain";
import { InvoiceEditableFields } from "../../entities/invoice/InvoiceFields";
import { createSalesInvoice } from "../../services/invoice-workflow";
import type { AppDataState, ReadyWorkspaceData } from "../../shared/model/workspace";
import { applyWorkspaceUpdate } from "../../shared/lib/workspace-overview";

type ReadyAppData = ReadyWorkspaceData;

export function InvoiceCreateForm({
  customerParties,
  data,
  onDataStateChange
}: {
  customerParties: Party[];
  data: ReadyAppData;
  onDataStateChange: (state: AppDataState) => void;
}) {
  const navigate = useNavigate();
  const [partyId, setPartyId] = useState(customerParties[0]?.id ?? "");
  const [number, setNumber] = useState("2026-0001");
  const [issueDate, setIssueDate] = useState("2026-05-10");
  const [total, setTotal] = useState("1000.00");
  const [actionState, setActionState] = useState<"idle" | "saving">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCreateInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionState("saving");
    setErrorMessage(null);

    try {
      if (!partyId) {
        throw new Error("Select a customer counterparty first.");
      }

      const update = await createSalesInvoice({
        workspaceId: data.workspace.id,
        partyId,
        number,
        issueDate,
        total,
        currency: data.workspace.baseCurrency
      });
      const createdInvoice = update.invoice;

      onDataStateChange(applyWorkspaceUpdate(data, update));

      if (createdInvoice) {
        void navigate({
          to: "/workspace/sales/invoices/$invoiceId",
          params: { invoiceId: createdInvoice.id }
        });
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Invoice was not created.");
    } finally {
      setActionState("idle");
    }
  }

  return (
    <section className="panel" aria-labelledby="create-invoice-title">
      <div className="panel-header">
        <h2 id="create-invoice-title">Create invoice</h2>
        <Link className="secondary-button" to="/workspace/sales/invoices">
          Back to list
        </Link>
      </div>

      <form className="invoice-form" onSubmit={(event) => void handleCreateInvoice(event)}>
        <InvoiceEditableFields
          currency={data.workspace.baseCurrency}
          customerParties={customerParties}
          issueDate={issueDate}
          number={number}
          partyId={partyId}
          total={total}
          onIssueDateChange={setIssueDate}
          onNumberChange={setNumber}
          onPartyIdChange={setPartyId}
          onTotalChange={setTotal}
        />
        <button className="primary-button" type="submit" disabled={actionState !== "idle"}>
          {actionState === "saving" ? "Creating" : "Create invoice"}
        </button>
      </form>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </section>
  );
}
