import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import type { Invoice, Party } from "../../domain";
import { InvoiceEditableFields } from "../../entities/invoice/InvoiceFields";
import { updateSalesInvoice } from "../../services/invoice-workflow";

export function InvoiceEditForm({
  customerParties,
  invoice
}: {
  customerParties: Party[];
  invoice: Invoice;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const [partyId, setPartyId] = useState(invoice.partyId);
  const [number, setNumber] = useState(invoice.number);
  const [issueDate, setIssueDate] = useState(invoice.issueDate);
  const [total, setTotal] = useState(invoice.total);
  const [actionState, setActionState] = useState<"idle" | "updating">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setPartyId(invoice.partyId);
    setNumber(invoice.number);
    setIssueDate(invoice.issueDate);
    setTotal(invoice.total);
  }, [invoice]);

  async function handleUpdateInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionState("updating");
    setErrorMessage(null);

    try {
      const update = await updateSalesInvoice({
        invoiceId: invoice.id,
        partyId,
        number,
        issueDate,
        total
      });

      await router.invalidate();
      void navigate({
        to: "/workspace/sales/invoices/$invoiceId",
        params: { invoiceId: invoice.id }
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Invoice was not updated.");
    } finally {
      setActionState("idle");
    }
  }

  return (
    <form className="invoice-form" onSubmit={(event) => void handleUpdateInvoice(event)}>
      <InvoiceEditableFields
        currency={invoice.currency}
        customerParties={customerParties}
        disabled={invoice.status !== "draft"}
        issueDate={issueDate}
        number={number}
        partyId={partyId}
        total={total}
        onIssueDateChange={setIssueDate}
        onNumberChange={setNumber}
        onPartyIdChange={setPartyId}
        onTotalChange={setTotal}
      />
      {invoice.status !== "draft" ? (
        <p className="field-note">Issued invoices cannot be edited. Undo issue first.</p>
      ) : null}
      <div className="transaction-detail-actions">
        <button
          className="primary-button"
          type="submit"
          disabled={actionState !== "idle" || invoice.status !== "draft"}
        >
          {actionState === "updating" ? "Saving invoice" : "Save invoice"}
        </button>
        <Link
          className="secondary-button"
          to="/workspace/sales/invoices/$invoiceId"
          params={{ invoiceId: invoice.id }}
        >
          Cancel
        </Link>
      </div>
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </form>
  );
}
