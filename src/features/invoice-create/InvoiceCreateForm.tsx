import { useState, type FormEvent } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import type { Party } from "../../domain";
import { InvoiceEditableFields } from "../../entities/invoice/InvoiceFields";
import { createSalesInvoice } from "../../services/invoice-workflow";

export function InvoiceCreateForm({
  baseCurrency,
  customerParties,
  workspaceId
}: {
  baseCurrency: string;
  customerParties: Party[];
  workspaceId: string;
}) {
  const navigate = useNavigate();
  const router = useRouter();
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
        workspaceId,
        partyId,
        number,
        issueDate,
        total,
        currency: baseCurrency
      });
      const createdInvoice = update.invoice;

      await router.invalidate();

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
          currency={baseCurrency}
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
