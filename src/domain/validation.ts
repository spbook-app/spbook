export type ValidationIssue = {
  code: string;
  message: string;
  path?: string;
};

export type ValidationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      issues: ValidationIssue[];
    };

export function valid(): ValidationResult {
  return { ok: true };
}

export function invalid(issues: ValidationIssue | ValidationIssue[]): ValidationResult {
  return {
    ok: false,
    issues: Array.isArray(issues) ? issues : [issues]
  };
}

export function combineValidationResults(results: ValidationResult[]): ValidationResult {
  const issues = results.flatMap((result) => (result.ok ? [] : result.issues));
  return issues.length === 0 ? valid() : invalid(issues);
}
