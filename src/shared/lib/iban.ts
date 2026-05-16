import { isValidIban } from "../../services/bank-workflow";

export function getIbanValidationMessage(iban: string) {
  const normalized = iban.replace(/\s+/g, "").toUpperCase();

  if (!normalized) {
    return null;
  }

  if (!isValidIban(normalized)) {
    return "Enter a valid IBAN, for example SI56 1910 0000 0123 438.";
  }

  return null;
}
