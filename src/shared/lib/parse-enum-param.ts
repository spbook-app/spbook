/** Parse an unknown URL search value against an allowed set, or undefined when absent/invalid. */
export function parseEnumParam<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}
