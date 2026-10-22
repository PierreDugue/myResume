import { PathKind, SchemaPath, SchemaPathRules, validate } from '@angular/forms/signals';

/** Trimmed text, or null when empty (optional API fields). */
export function textOrNull(value: string | null | undefined): string | null {
  const text = (value ?? '').trim();
  return text === '' ? null : text;
}

/** A number from an input, or null when empty. */
export function numberOrNull(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

type StringPath<K extends PathKind> = SchemaPath<string, SchemaPathRules.Supported, K>;

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/** Empty, or an http(s) URL (same rule as the API). */
export function httpUrl<K extends PathKind = PathKind.Root>(path: StringPath<K>): void {
  validate(path, ({ value }) => {
    const text = value().trim();
    return text === '' || isHttpUrl(text)
      ? undefined
      : { kind: 'httpUrl', message: 'Enter a URL starting with http:// or https://' };
  });
}

/** The end date (if set) can't be before the start date. The error goes on the end date. */
export function endOnOrAfterStart<K extends PathKind = PathKind.Root>(
  start: StringPath<K>,
  end: StringPath<K>,
): void {
  validate(end, ({ value, valueOf }) => {
    const startDate = valueOf(start);
    return startDate && value() && value() < startDate
      ? { kind: 'endBeforeStart', message: 'The end date must be after the start date' }
      : undefined;
  });
}

/** Show a field's errors once the user left it, or tried to submit (which touches every field). */
export function showError(field: { touched(): boolean; invalid(): boolean }): boolean {
  return field.touched() && field.invalid();
}
