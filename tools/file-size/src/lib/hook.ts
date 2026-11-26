import { countLines, isChecked, LIMITS } from './file-size.ts';

/**
 * What the Claude Code hook tells the agent after a Write or Edit: a message when the file is now
 * over the limit, or `null` to stay silent. `read` returns the file's text, or `null` if it can't.
 */
export function hookFeedback(input: unknown, read: (path: string) => string | null): string | null {
  const path = filePath(input);
  if (path === null || !isChecked(path)) return null;
  const text = read(path);
  if (text === null) return null;
  const lines = countLines(text);
  if (lines <= LIMITS.max) return null;
  return (
    `${path} now has ${lines} lines, over the ${LIMITS.max}-line limit (the build fails). ` +
    `Split it by responsibility, aiming for about ${LIMITS.target} lines per file (CLAUDE.md, "File size").`
  );
}

function filePath(input: unknown): string | null {
  if (typeof input !== 'object' || input === null) return null;
  const toolInput = (input as { tool_input?: unknown }).tool_input;
  if (typeof toolInput !== 'object' || toolInput === null) return null;
  const path = (toolInput as { file_path?: unknown }).file_path;
  return typeof path === 'string' ? path : null;
}
