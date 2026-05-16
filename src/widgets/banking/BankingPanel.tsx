import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { BankTransaction } from "../../domain";
import type { AppDataState } from "../../app/App";
import {
  createBankAccount,
  createBankTransaction,
  isValidIban,
  linkBankTransactionParty,
  matchInvoicePaymentFromBankTransaction,
  matchSupplierPaymentFromBankTransaction,
  postBankFeeFromBankTransaction,
  undoBankTransactionPosting,
  updateBankAccount,
  updateBankTransaction
} from "../../services/bank-workflow";
import {
  autoLinkImportedBankTransactions,
  importCamt053BankTransactions
} from "../../services/camt053-import";
import { createParty } from "../../services/party-workflow";
import type { WorkspaceOverview } from "../../services/workspace-overview";
import { mapOverviewToReadyState } from "../../shared/lib/workspace-overview";

function getIbanValidationMessage(iban: string) {
  const normalized = iban.replace(/\s+/g, "").toUpperCase();

  if (!normalized) {
    return null;
  }

  if (!isValidIban(normalized)) {
    return "Enter a valid IBAN, for example SI56 1910 0000 0123 438.";
  }

  return null;
}

function isSameStatementCounterparty(
  partyName: string,
  partyIban: string | undefined,
  statementCounterpartyName: string | undefined,
  statementCounterpartyIban: string | undefined
) {
  const normalizedPartyIban = normalizeIbanForCompare(partyIban);
  const normalizedStatementIban = normalizeIbanForCompare(statementCounterpartyIban);

  if (normalizedPartyIban && normalizedPartyIban === normalizedStatementIban) {
    return true;
  }

  return (
    partyName.trim().toLowerCase() ===
    statementCounterpartyName?.trim().toLowerCase()
  );
}

function normalizeIbanForCompare(iban: string | undefined) {
  return iban?.replace(/\s+/g, "").toUpperCase() ?? "";
}

function isIncomingBankTransaction(bankTransaction: BankTransaction) {
  return !bankTransaction.amount.startsWith("-");
}

function absoluteBankTransactionAmount(bankTransaction: BankTransaction) {
  return bankTransaction.amount.startsWith("-")
    ? bankTransaction.amount.slice(1)
    : bankTransaction.amount;
}

export function BankingPanel({
  data,
  onDataStateChange
}: {
  data: Extract<AppDataState, { state: "ready" }>;
  onDataStateChange: (state: AppDataState) => void;
}) {
  const bankPostingAccounts = data.accounts.filter(
    (account) => account.role === "posting" && account.code.startsWith("11")
  );
  const bankParties = data.parties.filter(
    (party) => party.active && party.roles.includes("bank")
  );
  const [accountName, setAccountName] = useState("NLB EUR");
  const [accountCode, setAccountCode] = useState(bankPostingAccounts[0]?.code ?? "");
  const [iban, setIban] = useState("");
  const [bankPartyId, setBankPartyId] = useState(bankParties[0]?.id ?? "");
  const [selectedEditBankAccountId, setSelectedEditBankAccountId] = useState(
    data.bankAccounts[0]?.id ?? ""
  );
  const selectedEditBankAccount =
    data.bankAccounts.find((bankAccount) => bankAccount.id === selectedEditBankAccountId) ??
    data.bankAccounts[0] ??
    null;
  const [editAccountName, setEditAccountName] = useState(selectedEditBankAccount?.name ?? "");
  const [editAccountCode, setEditAccountCode] = useState(
    selectedEditBankAccount?.accountCode ?? bankPostingAccounts[0]?.code ?? ""
  );
  const [editIban, setEditIban] = useState(selectedEditBankAccount?.iban ?? "");
  const [editBankPartyId, setEditBankPartyId] = useState(
    selectedEditBankAccount?.partyId ?? ""
  );
  const [editActive, setEditActive] = useState(selectedEditBankAccount?.active ?? true);
  const [transactionBankAccountId, setTransactionBankAccountId] = useState(
    data.bankAccounts[0]?.id ?? ""
  );
  const [bookingDate, setBookingDate] = useState("2026-05-15");
  const [transactionAmount, setTransactionAmount] = useState("1000.00");
  const [description, setDescription] = useState("Bank transaction");
  const [reference, setReference] = useState("");
  const [selectedEditBankTransactionId, setSelectedEditBankTransactionId] = useState(
    data.bankTransactions[0]?.id ?? ""
  );
  const selectedEditBankTransaction =
    data.bankTransactions.find(
      (bankTransaction) => bankTransaction.id === selectedEditBankTransactionId
    ) ??
    data.bankTransactions[0] ??
    null;
  const canEditSelectedBankTransaction =
    selectedEditBankTransaction?.status === "unmatched" &&
    !selectedEditBankTransaction.importSource;
  const selectedStatementCounterpartyExists = selectedEditBankTransaction
    ? data.parties.some((party) =>
        isSameStatementCounterparty(
          party.name,
          party.iban,
          selectedEditBankTransaction.counterpartyName,
          selectedEditBankTransaction.counterpartyIban
        )
      )
    : false;
  const selectedStatementCounterpartyCandidate = selectedEditBankTransaction
    ? data.parties.find((party) =>
        isSameStatementCounterparty(
          party.name,
          party.iban,
          selectedEditBankTransaction.counterpartyName,
          selectedEditBankTransaction.counterpartyIban
        )
      ) ?? null
    : null;
  const canCreateCounterpartyFromSelectedTransaction = Boolean(
    selectedEditBankTransaction?.importSource &&
      selectedEditBankTransaction.counterpartyName &&
      !selectedStatementCounterpartyExists
  );
  const suggestedInvoiceMatch =
    selectedEditBankTransaction?.status === "unmatched" &&
    selectedEditBankTransaction.partyId &&
    isIncomingBankTransaction(selectedEditBankTransaction)
      ? data.invoices.find(
          (invoice) =>
            invoice.partyId === selectedEditBankTransaction.partyId &&
            invoice.status !== "paid" &&
            invoice.status !== "cancelled" &&
            invoice.currency === selectedEditBankTransaction.currency &&
            invoice.total === selectedEditBankTransaction.amount
        ) ?? null
      : null;
  const suggestedSupplierInvoiceMatch =
    selectedEditBankTransaction?.status === "unmatched" &&
    selectedEditBankTransaction.partyId &&
    !isIncomingBankTransaction(selectedEditBankTransaction)
      ? data.supplierInvoices.find(
          (supplierInvoice) =>
            supplierInvoice.partyId === selectedEditBankTransaction.partyId &&
            supplierInvoice.status !== "paid" &&
            supplierInvoice.status !== "cancelled" &&
            supplierInvoice.currency === selectedEditBankTransaction.currency &&
            supplierInvoice.total ===
              absoluteBankTransactionAmount(selectedEditBankTransaction)
        ) ?? null
      : null;
  const [editTransactionBankAccountId, setEditTransactionBankAccountId] = useState(
    selectedEditBankTransaction?.bankAccountId ?? data.bankAccounts[0]?.id ?? ""
  );
  const [editBookingDate, setEditBookingDate] = useState(
    selectedEditBankTransaction?.bookingDate ?? "2026-05-15"
  );
  const [editTransactionAmount, setEditTransactionAmount] = useState(
    selectedEditBankTransaction?.amount ?? "1000.00"
  );
  const [editReference, setEditReference] = useState(
    selectedEditBankTransaction?.reference ?? ""
  );
  const [editDescription, setEditDescription] = useState(
    selectedEditBankTransaction?.description ?? ""
  );
  const [linkedPartyId, setLinkedPartyId] = useState(
    selectedEditBankTransaction?.partyId ?? selectedStatementCounterpartyCandidate?.id ?? ""
  );
  const [actionState, setActionState] = useState<
    | "idle"
    | "account"
    | "account-update"
    | "auto-link"
    | "statement-import"
    | "party-create"
    | "party-link"
    | "transaction"
    | "transaction-update"
    | "invoice-match"
    | "supplier-match"
    | "fee"
    | "undo"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const selectedBankAccountId = transactionBankAccountId || data.bankAccounts[0]?.id || "";
  const activeBankAccounts = data.bankAccounts.filter((bankAccount) => bankAccount.active);
  const usedActiveAccountCodes = new Set(
    data.bankAccounts
      .filter((bankAccount) => bankAccount.active)
      .map((bankAccount) => bankAccount.accountCode)
  );
  const createBankAccountOptions = bankPostingAccounts.filter(
    (account) => !usedActiveAccountCodes.has(account.code)
  );
  const editBankAccountOptions = bankPostingAccounts.filter(
    (account) =>
      !usedActiveAccountCodes.has(account.code) ||
      account.code === selectedEditBankAccount?.accountCode
  );
  const ibanValidationMessage = getIbanValidationMessage(iban);
  const editIbanValidationMessage = getIbanValidationMessage(editIban);
  const canCreateBankAccount =
    actionState === "idle" &&
    createBankAccountOptions.length > 0 &&
    !ibanValidationMessage;

  useEffect(() => {
    if (!selectedEditBankAccount) return;

    setSelectedEditBankAccountId(selectedEditBankAccount.id);
    setEditAccountName(selectedEditBankAccount.name);
    setEditAccountCode(selectedEditBankAccount.accountCode);
    setEditIban(selectedEditBankAccount.iban ?? "");
    setEditBankPartyId(selectedEditBankAccount.partyId ?? "");
    setEditActive(selectedEditBankAccount.active);
  }, [selectedEditBankAccount]);

  useEffect(() => {
    if (createBankAccountOptions.length > 0 && !createBankAccountOptions.some((account) => account.code === accountCode)) {
      setAccountCode(createBankAccountOptions[0]!.code);
    }
  }, [accountCode, createBankAccountOptions]);

  useEffect(() => {
    if (!selectedEditBankTransaction) return;

    setSelectedEditBankTransactionId(selectedEditBankTransaction.id);
    setEditTransactionBankAccountId(selectedEditBankTransaction.bankAccountId);
    setEditBookingDate(selectedEditBankTransaction.bookingDate);
    setEditTransactionAmount(selectedEditBankTransaction.amount);
    setEditReference(selectedEditBankTransaction.reference ?? "");
    setEditDescription(selectedEditBankTransaction.description);
    setLinkedPartyId(
      selectedEditBankTransaction.partyId ?? selectedStatementCounterpartyCandidate?.id ?? ""
    );
  }, [selectedEditBankTransaction, selectedStatementCounterpartyCandidate?.id]);

  async function handleCreateBankAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    try {
      if (createBankAccountOptions.length === 0) {
        throw new Error("No unused bank posting accounts are available.");
      }

      if (ibanValidationMessage) {
        throw new Error(ibanValidationMessage);
      }

      setActionState("account");
      const overview = await createBankAccount({
        workspaceId: data.workspace.id,
        name: accountName,
        accountCode,
        currency: data.workspace.baseCurrency,
        iban,
        partyId: bankPartyId
      });

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setTransactionBankAccountId(overview.bankAccounts.at(-1)?.id ?? "");
      setSelectedEditBankAccountId(overview.bankAccounts.at(-1)?.id ?? "");
      setIban("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Bank account was not created."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleUpdateBankAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    try {
      if (!selectedEditBankAccount) {
        throw new Error("Select a bank account first.");
      }

      if (editIbanValidationMessage) {
        throw new Error(editIbanValidationMessage);
      }

      setActionState("account-update");
      const overview = await updateBankAccount({
        bankAccountId: selectedEditBankAccount.id,
        name: editAccountName,
        accountCode: editAccountCode,
        iban: editIban,
        partyId: editBankPartyId,
        active: editActive
      });

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedEditBankTransactionId(overview.bankTransactions.at(-1)?.id ?? "");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Bank account was not updated."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleCreateBankTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionState("transaction");
    setErrorMessage(null);

    try {
      if (!selectedBankAccountId) {
        throw new Error("Create a bank account first.");
      }

      const overview = await createBankTransaction({
        workspaceId: data.workspace.id,
        bankAccountId: selectedBankAccountId,
        bookingDate,
        amount: transactionAmount,
        currency: data.workspace.baseCurrency,
        description,
        reference
      });

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Bank transaction was not created."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleImportStatement(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);

    if (files.length === 0) return;

    setActionState("statement-import");
    setErrorMessage(null);
    setImportMessage(null);

    try {
      if (!selectedBankAccountId) {
        throw new Error("Create or select a bank account first.");
      }

      let nextOverview: WorkspaceOverview | null = null;
      let importedCount = 0;
      let skippedCount = 0;
      const failedFiles: string[] = [];

      for (const file of files) {
        try {
          const result = await importCamt053BankTransactions({
            workspaceId: data.workspace.id,
            bankAccountId: selectedBankAccountId,
            xml: await file.text()
          });

          nextOverview = result.overview;
          importedCount += result.importedCount;
          skippedCount += result.skippedCount;
        } catch {
          failedFiles.push(file.name);
        }
      }

      if (!nextOverview) {
        throw new Error("No selected bank statements could be imported.");
      }

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(nextOverview)
      });
      setImportMessage(
        `Imported ${importedCount} transactions, skipped ${skippedCount} duplicates from ${files.length - failedFiles.length} files.`
      );

      if (failedFiles.length > 0) {
        setErrorMessage(`Some files were not imported: ${failedFiles.join(", ")}.`);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Bank statement was not imported."
      );
    } finally {
      event.currentTarget.value = "";
      setActionState("idle");
    }
  }

  async function handleAutoLinkImportedTransactions() {
    setActionState("auto-link");
    setErrorMessage(null);
    setImportMessage(null);

    try {
      const result = await autoLinkImportedBankTransactions(data.workspace.id);

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(result.overview)
      });
      setImportMessage(`Linked ${result.linkedCount} imported transactions.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Imported transactions were not auto-linked."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleUpdateBankTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    try {
      if (!selectedEditBankTransaction) {
        throw new Error("Select a bank transaction first.");
      }

      setActionState("transaction-update");
      const overview = await updateBankTransaction({
        bankTransactionId: selectedEditBankTransaction.id,
        bankAccountId: editTransactionBankAccountId,
        bookingDate: editBookingDate,
        amount: editTransactionAmount,
        description: editDescription,
        reference: editReference
      });

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Bank transaction was not updated."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleCreateCounterpartyFromBankTransaction() {
    setErrorMessage(null);

    try {
      if (!selectedEditBankTransaction?.counterpartyName) {
        throw new Error("Selected bank transaction has no counterparty name.");
      }

      if (selectedStatementCounterpartyExists) {
        throw new Error("Counterparty already exists.");
      }

      setActionState("party-create");
      const overview = await createParty({
        workspaceId: data.workspace.id,
        name: selectedEditBankTransaction.counterpartyName,
        type: "business",
        roles: [selectedEditBankTransaction.amount.startsWith("-") ? "supplier" : "customer"],
        countryCode:
          selectedEditBankTransaction.counterpartyIban?.slice(0, 2) ??
          data.workspace.countryCode,
        iban: selectedEditBankTransaction.counterpartyIban
      });
      const createdParty = overview.parties.find((party) =>
        isSameStatementCounterparty(
          party.name,
          party.iban,
          selectedEditBankTransaction.counterpartyName,
          selectedEditBankTransaction.counterpartyIban
        )
      );
      const linkedOverview = createdParty
        ? await linkBankTransactionParty({
            bankTransactionId: selectedEditBankTransaction.id,
            partyId: createdParty.id
          })
        : overview;

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(linkedOverview)
      });
      setSelectedEditBankTransactionId(selectedEditBankTransaction.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Counterparty was not created."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleLinkBankTransactionParty() {
    setErrorMessage(null);

    try {
      if (!selectedEditBankTransaction) {
        throw new Error("Select a bank transaction first.");
      }

      setActionState("party-link");
      const overview = await linkBankTransactionParty({
        bankTransactionId: selectedEditBankTransaction.id,
        partyId: linkedPartyId
      });

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedEditBankTransactionId(selectedEditBankTransaction.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Counterparty was not linked."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleMatchSuggestedInvoice(invoiceId: string) {
    setActionState("invoice-match");
    setErrorMessage(null);

    try {
      if (!selectedEditBankTransaction) {
        throw new Error("Select a bank transaction first.");
      }

      const overview = await matchInvoicePaymentFromBankTransaction(
        invoiceId,
        selectedEditBankTransaction.id
      );

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedEditBankTransactionId(selectedEditBankTransaction.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Invoice payment was not matched."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleMatchSuggestedSupplierInvoice(supplierInvoiceId: string) {
    setActionState("supplier-match");
    setErrorMessage(null);

    try {
      if (!selectedEditBankTransaction) {
        throw new Error("Select a bank transaction first.");
      }

      const overview = await matchSupplierPaymentFromBankTransaction(
        supplierInvoiceId,
        selectedEditBankTransaction.id
      );

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedEditBankTransactionId(selectedEditBankTransaction.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Supplier invoice payment was not matched."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handlePostBankFee(bankTransactionId: string) {
    setActionState("fee");
    setErrorMessage(null);

    try {
      const overview = await postBankFeeFromBankTransaction(bankTransactionId);

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Bank fee was not posted.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleUndoBankTransactionPosting(bankTransactionId: string) {
    setActionState("undo");
    setErrorMessage(null);

    try {
      const overview = await undoBankTransactionPosting(bankTransactionId);

      onDataStateChange({
        ...data,
        ...mapOverviewToReadyState(overview)
      });
      setSelectedEditBankTransactionId(bankTransactionId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Posting was not undone.");
    } finally {
      setActionState("idle");
    }
  }

  return (
    <section className="panel panel-wide" aria-labelledby="banking-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Banking</p>
          <h2 id="banking-title">Bank accounts and transactions</h2>
        </div>
        <span>
          {data.bankAccounts.length} accounts · {data.bankTransactions.length} transactions
        </span>
      </div>

      <div className="banking-section">
        <div className="subsection-header">
          <div>
            <h3>Bank accounts</h3>
            <p>Each active bank account uses a dedicated posting account.</p>
          </div>
        </div>

        <form className="invoice-form" onSubmit={(event) => void handleCreateBankAccount(event)}>
          <div className="form-row">
            <label>
              <span>Account name</span>
              <input value={accountName} onChange={(event) => setAccountName(event.target.value)} />
            </label>
            <label>
              <span>Account code</span>
              <select value={accountCode} onChange={(event) => setAccountCode(event.target.value)}>
                {createBankAccountOptions.map((account) => (
                  <option key={account.id} value={account.code}>
                    {account.code} · {account.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            <span>Bank party</span>
            <select value={bankPartyId} onChange={(event) => setBankPartyId(event.target.value)}>
              <option value="">No bank party</option>
              {bankParties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.name}
                  {party.iban ? ` · ${party.iban}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>IBAN</span>
            <input
              aria-invalid={ibanValidationMessage ? "true" : "false"}
              placeholder="SI56 1910 0000 0123 438"
              value={iban}
              onChange={(event) => setIban(event.target.value)}
            />
          </label>
          {ibanValidationMessage ? (
            <p className="field-error">{ibanValidationMessage}</p>
          ) : null}
          {createBankAccountOptions.length === 0 ? (
            <p className="field-note">No unused bank posting accounts are available.</p>
          ) : null}
          <button
            className="primary-button"
            type="submit"
            disabled={!canCreateBankAccount}
          >
            {actionState === "account" ? "Creating" : "Create bank account"}
          </button>
        </form>

        <div className="bank-account-list">
          {data.bankAccounts.length === 0 ? (
            <p className="empty-state">No bank accounts yet.</p>
          ) : null}
          {data.bankAccounts.map((bankAccount) => (
            <button
              className={`bank-account-row ${
                selectedEditBankAccount?.id === bankAccount.id ? "bank-account-row-active" : ""
              }`}
              key={bankAccount.id}
              type="button"
              onClick={() => setSelectedEditBankAccountId(bankAccount.id)}
            >
              <strong>{bankAccount.name}</strong>
              <span>
                {bankAccount.accountCode} · {bankAccount.currency}
                {bankAccount.iban ? ` · ${bankAccount.iban}` : ""}
              </span>
              {bankAccount.partyId ? (
                <small>
                  {data.parties.find((party) => party.id === bankAccount.partyId)?.name ??
                    "Unknown bank party"}
                </small>
              ) : null}
              <small>{bankAccount.active ? "active" : "inactive"}</small>
            </button>
          ))}
        </div>

        {selectedEditBankAccount ? (
          <form
            className="invoice-form edit-bank-account-form"
            onSubmit={(event) => void handleUpdateBankAccount(event)}
          >
            <div className="form-row">
              <label>
                <span>Edit name</span>
                <input
                  value={editAccountName}
                  onChange={(event) => setEditAccountName(event.target.value)}
                />
              </label>
              <label>
                <span>Edit posting account</span>
                <select
                  value={editAccountCode}
                  onChange={(event) => setEditAccountCode(event.target.value)}
                >
                  {editBankAccountOptions.map((account) => (
                    <option key={account.id} value={account.code}>
                      {account.code} · {account.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              <span>Edit bank party</span>
              <select
                value={editBankPartyId}
                onChange={(event) => setEditBankPartyId(event.target.value)}
              >
                <option value="">No bank party</option>
                {bankParties.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.name}
                    {party.iban ? ` · ${party.iban}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Edit IBAN</span>
              <input
                aria-invalid={editIbanValidationMessage ? "true" : "false"}
                placeholder="SI56 1910 0000 0123 438"
                value={editIban}
                onChange={(event) => setEditIban(event.target.value)}
              />
            </label>
            {editIbanValidationMessage ? (
              <p className="field-error">{editIbanValidationMessage}</p>
            ) : null}
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={editActive}
                onChange={(event) => setEditActive(event.target.checked)}
              />
              <span>Active bank account</span>
            </label>
            <button
              className="secondary-button"
              type="submit"
              disabled={actionState !== "idle" || Boolean(editIbanValidationMessage)}
            >
              {actionState === "account-update" ? "Saving" : "Save bank account"}
            </button>
          </form>
        ) : null}
      </div>

      <div className="banking-section">
        <div className="subsection-header">
          <div>
            <h3>Statement import</h3>
            <p>Import ISO 20022 CAMT.053 XML statements into the selected bank account.</p>
          </div>
        </div>

        <div className="statement-import-row">
          <label>
            <span>Bank account</span>
            <select
              value={selectedBankAccountId}
              onChange={(event) => setTransactionBankAccountId(event.target.value)}
            >
              <option value="">Select bank account</option>
              {activeBankAccounts.map((bankAccount) => (
                <option key={bankAccount.id} value={bankAccount.id}>
                  {bankAccount.name} · {bankAccount.accountCode}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>CAMT.053 XML</span>
            <input
              accept=".xml,application/xml,text/xml"
              disabled={actionState !== "idle" || !selectedBankAccountId}
              multiple
              type="file"
              onChange={(event) => void handleImportStatement(event)}
            />
          </label>
        </div>
        {actionState === "statement-import" ? (
          <p className="field-note">Importing bank statement.</p>
        ) : null}
        <button
          className="secondary-button"
          type="button"
          disabled={actionState !== "idle"}
          onClick={() => void handleAutoLinkImportedTransactions()}
        >
          {actionState === "auto-link" ? "Auto-linking" : "Auto-link imported transactions"}
        </button>
        {importMessage ? <p className="field-note">{importMessage}</p> : null}
      </div>

      <div className="banking-section">
        <div className="subsection-header">
          <div>
            <h3>Bank transactions</h3>
            <p>Add signed account movements and match them to documents.</p>
          </div>
        </div>

        <form className="invoice-form" onSubmit={(event) => void handleCreateBankTransaction(event)}>
          <div className="form-row">
            <label>
              <span>Bank account</span>
              <select
                value={selectedBankAccountId}
                onChange={(event) => setTransactionBankAccountId(event.target.value)}
              >
                <option value="">Select bank account</option>
                {activeBankAccounts.map((bankAccount) => (
                  <option key={bankAccount.id} value={bankAccount.id}>
                    {bankAccount.name} · {bankAccount.accountCode}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Booking date</span>
              <input
                type="date"
                value={bookingDate}
                onChange={(event) => setBookingDate(event.target.value)}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              <span>Signed amount</span>
              <input
                value={transactionAmount}
                onChange={(event) => setTransactionAmount(event.target.value)}
              />
            </label>
            <label>
              <span>Reference</span>
              <input value={reference} onChange={(event) => setReference(event.target.value)} />
            </label>
          </div>
          <label>
            <span>Description</span>
            <input value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <button className="primary-button" type="submit" disabled={actionState !== "idle"}>
            {actionState === "transaction" ? "Creating" : "Create bank transaction"}
          </button>
        </form>

        <div className="transaction-list">
          {data.bankTransactions.length === 0 ? (
            <p className="empty-state">No bank transactions yet.</p>
          ) : null}
          {data.bankTransactions.map((bankTransaction) => {
            const bankAccount = data.bankAccounts.find(
              (candidate) => candidate.id === bankTransaction.bankAccountId
            );
            const canPostFee =
              bankTransaction.status === "unmatched" && bankTransaction.amount.startsWith("-");

            return (
              <article className="transaction-row" key={bankTransaction.id}>
                <button
                  className={`transaction-pick ${
                    selectedEditBankTransaction?.id === bankTransaction.id
                      ? "transaction-pick-active"
                      : ""
                  }`}
                  type="button"
                  onClick={() => setSelectedEditBankTransactionId(bankTransaction.id)}
                >
                  <strong>
                    {bankTransaction.amount} {bankTransaction.currency}
                  </strong>
                  <span>
                    {bankTransaction.bookingDate} · {bankAccount?.name ?? "Unknown account"} ·{" "}
                    {bankTransaction.status}
                  </span>
                  <small>{bankTransaction.description}</small>
                  {bankTransaction.counterpartyName || bankTransaction.externalId ? (
                    <span className="transaction-details">
                      <span>
                        Statement counterparty: {bankTransaction.counterpartyName ?? "Unknown"}
                      </span>
                      {bankTransaction.counterpartyIban ? (
                        <span>
                          Statement counterparty IBAN: {bankTransaction.counterpartyIban}
                        </span>
                      ) : null}
                      {bankTransaction.reference ? (
                        <span>Reference: {bankTransaction.reference}</span>
                      ) : null}
                      {bankTransaction.remittanceInformation ? (
                        <span>Remittance: {bankTransaction.remittanceInformation}</span>
                      ) : null}
                      {bankTransaction.valueDate ? (
                        <span>Value date: {bankTransaction.valueDate}</span>
                      ) : null}
                      {bankTransaction.bankReference ? (
                        <span>Bank reference: {bankTransaction.bankReference}</span>
                      ) : null}
                    </span>
                  ) : null}
                </button>
                {canPostFee ? (
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={actionState !== "idle"}
                    onClick={() => void handlePostBankFee(bankTransaction.id)}
                  >
                    Post bank fee
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>

        {selectedEditBankTransaction ? (
          <form
            className="invoice-form edit-bank-account-form"
            onSubmit={(event) => void handleUpdateBankTransaction(event)}
          >
            <BankTransactionDetailPanel
              bankAccountName={
                data.bankAccounts.find(
                  (bankAccount) =>
                    bankAccount.id === selectedEditBankTransaction.bankAccountId
                )?.name ?? "Unknown account"
              }
              bankTransaction={selectedEditBankTransaction}
              canCreateCounterparty={canCreateCounterpartyFromSelectedTransaction}
              counterpartyExists={selectedStatementCounterpartyExists}
              isLinkingCounterparty={actionState === "party-link"}
              isCreatingCounterparty={actionState === "party-create"}
              linkedPartyId={linkedPartyId}
              parties={data.parties}
              suggestedPartyId={selectedStatementCounterpartyCandidate?.id}
              suggestedInvoice={suggestedInvoiceMatch}
              suggestedSupplierInvoice={suggestedSupplierInvoiceMatch}
              isMatchingInvoice={actionState === "invoice-match"}
              isMatchingSupplierInvoice={actionState === "supplier-match"}
              isPostingBankFee={actionState === "fee"}
              isUndoingPosting={actionState === "undo"}
              onCreateCounterparty={() => void handleCreateCounterpartyFromBankTransaction()}
              onMatchInvoice={(invoiceId) => void handleMatchSuggestedInvoice(invoiceId)}
              onMatchSupplierInvoice={(supplierInvoiceId) =>
                void handleMatchSuggestedSupplierInvoice(supplierInvoiceId)
              }
              onPostBankFee={() => void handlePostBankFee(selectedEditBankTransaction.id)}
              onLinkCounterparty={() => void handleLinkBankTransactionParty()}
              onLinkedPartyChange={setLinkedPartyId}
              onUndoPosting={() =>
                void handleUndoBankTransactionPosting(selectedEditBankTransaction.id)
              }
            />
            <div className="form-row">
              <label>
                <span>Edit bank account</span>
                <select
                  value={editTransactionBankAccountId}
                  onChange={(event) => setEditTransactionBankAccountId(event.target.value)}
                  disabled={!canEditSelectedBankTransaction}
                >
                  {activeBankAccounts.map((bankAccount) => (
                    <option key={bankAccount.id} value={bankAccount.id}>
                      {bankAccount.name} · {bankAccount.accountCode}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Edit booking date</span>
                <input
                  type="date"
                  value={editBookingDate}
                  disabled={!canEditSelectedBankTransaction}
                  onChange={(event) => setEditBookingDate(event.target.value)}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                <span>Edit signed amount</span>
                <input
                  value={editTransactionAmount}
                  disabled={!canEditSelectedBankTransaction}
                  onChange={(event) => setEditTransactionAmount(event.target.value)}
                />
              </label>
              <label>
                <span>Edit reference</span>
                <input
                  value={editReference}
                  disabled={!canEditSelectedBankTransaction}
                  onChange={(event) => setEditReference(event.target.value)}
                />
              </label>
            </div>
            <label>
              <span>Edit description</span>
              <input
                value={editDescription}
                disabled={!canEditSelectedBankTransaction}
                onChange={(event) => setEditDescription(event.target.value)}
              />
            </label>
            {selectedEditBankTransaction.importSource ? (
              <p className="field-note">
                Imported bank statement entries cannot be edited. Match, post, or
                ignore them instead.
              </p>
            ) : null}
            {selectedEditBankTransaction.status !== "unmatched" ? (
              <p className="field-note">
                Processed bank transactions cannot be edited after matching or posting.
              </p>
            ) : null}
            <button
              className="secondary-button"
              type="submit"
              disabled={
                actionState !== "idle" || !canEditSelectedBankTransaction
              }
            >
              {actionState === "transaction-update"
                ? "Saving"
                : "Save bank transaction"}
            </button>
          </form>
        ) : null}
      </div>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </section>
  );
}

function BankTransactionDetailPanel({
  bankAccountName,
  bankTransaction,
  canCreateCounterparty,
  counterpartyExists,
  isLinkingCounterparty,
  isCreatingCounterparty,
  linkedPartyId,
  parties,
  suggestedPartyId,
  suggestedInvoice,
  suggestedSupplierInvoice,
  isMatchingInvoice,
  isMatchingSupplierInvoice,
  isPostingBankFee,
  isUndoingPosting,
  onCreateCounterparty,
  onMatchInvoice,
  onMatchSupplierInvoice,
  onPostBankFee,
  onLinkCounterparty,
  onLinkedPartyChange,
  onUndoPosting
}: {
  bankAccountName: string;
  bankTransaction: BankTransaction;
  canCreateCounterparty: boolean;
  counterpartyExists: boolean;
  isLinkingCounterparty: boolean;
  isCreatingCounterparty: boolean;
  linkedPartyId: string;
  parties: Extract<AppDataState, { state: "ready" }>["parties"];
  suggestedPartyId?: string;
  suggestedInvoice: Extract<AppDataState, { state: "ready" }>["invoices"][number] | null;
  suggestedSupplierInvoice:
    | Extract<AppDataState, { state: "ready" }>["supplierInvoices"][number]
    | null;
  isMatchingInvoice: boolean;
  isMatchingSupplierInvoice: boolean;
  isPostingBankFee: boolean;
  isUndoingPosting: boolean;
  onCreateCounterparty: () => void;
  onMatchInvoice: (invoiceId: string) => void;
  onMatchSupplierInvoice: (supplierInvoiceId: string) => void;
  onPostBankFee: () => void;
  onLinkCounterparty: () => void;
  onLinkedPartyChange: (partyId: string) => void;
  onUndoPosting: () => void;
}) {
  const linkedParty = parties.find((party) => party.id === bankTransaction.partyId);
  const details = [
    ["Bank account", bankAccountName],
    ["Linked counterparty", linkedParty?.name],
    ["Booking date", bankTransaction.bookingDate],
    ["Value date", bankTransaction.valueDate],
    ["Amount", `${bankTransaction.amount} ${bankTransaction.currency}`],
    ["Status", bankTransaction.status],
    ["Description", bankTransaction.description],
    ["Reference", bankTransaction.reference],
    ["Statement counterparty", bankTransaction.counterpartyName],
    ["Statement counterparty IBAN", bankTransaction.counterpartyIban],
    ["Remittance", bankTransaction.remittanceInformation],
    ["Bank reference", bankTransaction.bankReference],
    ["Entry reference", bankTransaction.entryReference],
    ["Import source", bankTransaction.importSource],
    ["External ID", bankTransaction.externalId]
  ].filter(([, value]) => Boolean(value));

  return (
    <div className="transaction-detail-panel">
      <div className="subsection-header">
        <div>
          <h3>Selected transaction details</h3>
          <p>Bank statement data is shown as read-only text for copying.</p>
        </div>
      </div>
      <dl className="copyable-details">
        {details.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {bankTransaction.importSource ? (
        <div className="transaction-detail-actions">
          <label className="inline-select">
            <span>Link counterparty</span>
            <select
              value={linkedPartyId}
              disabled={bankTransaction.status !== "unmatched" || isLinkingCounterparty}
              onChange={(event) => onLinkedPartyChange(event.target.value)}
            >
              <option value="">No linked counterparty</option>
              {parties
                .filter((party) => party.active)
                .map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.name}
                    {party.iban ? ` · ${party.iban}` : ""}
                  </option>
                ))}
            </select>
          </label>
          <button
            className="secondary-button"
            type="button"
            disabled={bankTransaction.status !== "unmatched" || isLinkingCounterparty}
            onClick={onLinkCounterparty}
          >
            {isLinkingCounterparty ? "Linking" : "Link counterparty"}
          </button>
          {suggestedPartyId && !bankTransaction.partyId ? (
            <p className="field-note">
              Suggested by matching statement counterparty name or IBAN.
            </p>
          ) : null}
        </div>
      ) : null}
      {suggestedInvoice ? (
        <div className="transaction-detail-actions">
          <p className="field-note">
            Suggested invoice: {suggestedInvoice.number} · {suggestedInvoice.total}{" "}
            {suggestedInvoice.currency}
          </p>
          <button
            className="secondary-button"
            type="button"
            disabled={isMatchingInvoice}
            onClick={() => onMatchInvoice(suggestedInvoice.id)}
          >
            {isMatchingInvoice ? "Matching invoice" : "Match invoice"}
          </button>
        </div>
      ) : null}
      {suggestedSupplierInvoice ? (
        <div className="transaction-detail-actions">
          <p className="field-note">
            Suggested supplier invoice: {suggestedSupplierInvoice.number} ·{" "}
            {suggestedSupplierInvoice.total} {suggestedSupplierInvoice.currency}
          </p>
          <button
            className="secondary-button"
            type="button"
            disabled={isMatchingSupplierInvoice}
            onClick={() => onMatchSupplierInvoice(suggestedSupplierInvoice.id)}
          >
            {isMatchingSupplierInvoice
              ? "Matching supplier invoice"
              : "Match supplier invoice"}
          </button>
        </div>
      ) : null}
      <div className="transaction-detail-actions">
        {bankTransaction.status === "unmatched" && bankTransaction.amount.startsWith("-") ? (
          <button
            className="secondary-button"
            type="button"
            disabled={isPostingBankFee}
            onClick={onPostBankFee}
          >
            {isPostingBankFee ? "Posting bank fee" : "Post as bank fee"}
          </button>
        ) : null}
        {bankTransaction.status !== "unmatched" ? (
          <button
            className="secondary-button"
            type="button"
            disabled={isUndoingPosting}
            onClick={onUndoPosting}
          >
            {isUndoingPosting ? "Undoing" : "Undo posting"}
          </button>
        ) : null}
      </div>
      {bankTransaction.importSource && bankTransaction.counterpartyName ? (
        <div className="transaction-detail-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={!canCreateCounterparty || isCreatingCounterparty}
            onClick={onCreateCounterparty}
          >
            {isCreatingCounterparty ? "Creating counterparty" : "Create counterparty"}
          </button>
          {counterpartyExists ? (
            <p className="field-note">A counterparty with this name or IBAN already exists.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
