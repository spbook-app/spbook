import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import type { Party, SupplierInvoice } from "../../domain";
import { SupplierInvoiceEditableFields } from "../../entities/supplier-invoice/SupplierInvoiceFields";
import { updateSupplierInvoice } from "../../services/supplier-invoice-workflow";

export function SupplierInvoiceEditForm({
  supplierInvoice,
  supplierParties
}: {
  supplierInvoice: SupplierInvoice;
  supplierParties: Party[];
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const [partyId, setPartyId] = useState(supplierInvoice.partyId);
  const [number, setNumber] = useState(supplierInvoice.number);
  const [issueDate, setIssueDate] = useState(supplierInvoice.issueDate);
  const [total, setTotal] = useState(supplierInvoice.total);
  const [expenseAccountCode, setExpenseAccountCode] = useState(
    supplierInvoice.expenseAccountCode
  );
  const [actionState, setActionState] = useState<"idle" | "updating">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setPartyId(supplierInvoice.partyId);
    setNumber(supplierInvoice.number);
    setIssueDate(supplierInvoice.issueDate);
    setTotal(supplierInvoice.total);
    setExpenseAccountCode(supplierInvoice.expenseAccountCode);
  }, [supplierInvoice]);

  async function handleUpdateSupplierInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionState("updating");
    setErrorMessage(null);

    try {
      const update = await updateSupplierInvoice({
        supplierInvoiceId: supplierInvoice.id,
        partyId,
        number,
        issueDate,
        total,
        expenseAccountCode
      });

      await router.invalidate();
      void navigate({
        to: "/workspace/purchases/supplier-invoices/$supplierInvoiceId",
        params: { supplierInvoiceId: supplierInvoice.id }
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Supplier invoice was not updated."
      );
    } finally {
      setActionState("idle");
    }
  }

  return (
    <form
      className="invoice-form"
      onSubmit={(event) => void handleUpdateSupplierInvoice(event)}
    >
      <SupplierInvoiceEditableFields
        currency={supplierInvoice.currency}
        disabled={supplierInvoice.status === "paid"}
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
      <div className="transaction-detail-actions">
        <button
          className="primary-button"
          type="submit"
          disabled={actionState !== "idle" || supplierInvoice.status === "paid"}
        >
          {actionState === "updating" ? "Saving invoice" : "Save invoice"}
        </button>
        <Link
          className="secondary-button"
          to="/workspace/purchases/supplier-invoices/$supplierInvoiceId"
          params={{ supplierInvoiceId: supplierInvoice.id }}
        >
          Cancel
        </Link>
      </div>
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </form>
  );
}
