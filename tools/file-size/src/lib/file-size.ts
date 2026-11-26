/**
 * The file size rule (CLAUDE.md, "File size"): one responsibility per file, usually about 500 lines;
 * never more than 800.
 * Applies to source code and tests; docs, data and config files are not checked.
 */

export interface FileSize {
  path: string;
  lines: number;
}

export interface Limits {
  /** Where to check that a file still does one thing (guidance, not enforced). */
  target: number;
  /** The hard limit: a bigger file fails the build. */
  max: number;
}

export interface SizeCheck {
  /** Over `max`, biggest first. */
  tooBig: FileSize[];
  /** Over `target` but within `max`, biggest first. */
  overTarget: FileSize[];
}

export const LIMITS: Limits = { target: 500, max: 800 };

const CHECKED = /\.(?:[cm]?[jt]sx?|html|s?css)$/;

export function isChecked(path: string): boolean {
  return CHECKED.test(path);
}

/** Lines as an editor numbers them: a final newline doesn't start another line. */
export function countLines(text: string): number {
  if (text === '') return 0;
  const breaks = text.split('\n').length - 1;
  return text.endsWith('\n') ? breaks : breaks + 1;
}

export function checkFileSizes(files: readonly FileSize[], limits: Limits = LIMITS): SizeCheck {
  const biggestFirst = [...files].sort((a, b) => b.lines - a.lines);
  return {
    tooBig: biggestFirst.filter((f) => f.lines > limits.max),
    overTarget: biggestFirst.filter((f) => f.lines > limits.target && f.lines <= limits.max),
  };
}

export function formatReport(check: SizeCheck, limits: Limits = LIMITS): string {
  const parts: string[] = [];
  if (check.tooBig.length > 0) {
    parts.push(
      `${check.tooBig.length} file(s) over the ${limits.max}-line limit:`,
      ...check.tooBig.map((f) => `  ${f.path}: ${f.lines} lines`),
      `Split each one so every file does one thing (usually about ${limits.target} lines); see CLAUDE.md, "File size".`,
    );
  }
  if (check.overTarget.length > 0) {
    parts.push(
      `${check.overTarget.length} files are over ${limits.target} lines (fine up to ${limits.max} if each does one thing).`,
    );
  }
  return parts.join('\n');
}
