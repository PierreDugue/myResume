/**
 * The file size rule (CLAUDE.md, "File size"): aim for about 300 lines, never more than 600.
 * Applies to source code and tests; docs, data and config files are not checked.
 */

export interface FileSize {
  path: string;
  lines: number;
}

export interface Limits {
  /** Where a file should be split, if it has more than one responsibility. */
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

export const LIMITS: Limits = { target: 300, max: 600 };

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
      `Split each one by responsibility (aim for about ${limits.target} lines); see CLAUDE.md, "File size".`,
    );
  }
  if (check.overTarget.length > 0) {
    parts.push(
      `${check.overTarget.length} files are over the ${limits.target}-line target (allowed up to ${limits.max}).`,
    );
  }
  return parts.join('\n');
}
