export function isValidIban(iban: string) {
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) {
    return false;
  }

  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  let remainder = 0;

  for (const character of rearranged) {
    const value =
      character >= "A" && character <= "Z"
        ? `${character.charCodeAt(0) - 55}`
        : character;

    for (const digit of value) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }

  return remainder === 1;
}

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
