import { RE2JS } from 're2js';

export const MAX_REGEX_LENGTH = 100;

/**
 * Why `pattern` can't be used, or null if it can. Patterns use RE2 syntax (no back-references or
 * lookarounds). They come from visitors and run on the server, so they are matched with RE2, whose
 * time is linear in the input: no pattern can freeze the server.
 */
export function checkRegex(pattern: string): string | null {
  if (pattern.length > MAX_REGEX_LENGTH) {
    return `Regular expression too long: at most ${MAX_REGEX_LENGTH} characters`;
  }
  try {
    RE2JS.compile(pattern, RE2JS.CASE_INSENSITIVE);
    return null;
  } catch (e) {
    return `Invalid regular expression: ${(e as Error).message}`;
  }
}

/** A case-insensitive test for `pattern`: anywhere in the text, or the whole text with `whole`. */
export function regexTest(pattern: string, whole = false): (text: string) => boolean {
  const regex = RE2JS.compile(pattern, RE2JS.CASE_INSENSITIVE);
  return whole ? (text) => regex.matches(text) : (text) => regex.matcher(text).find();
}
