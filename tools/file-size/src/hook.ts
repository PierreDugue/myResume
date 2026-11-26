/**
 * Claude Code PostToolUse hook for Write and Edit (.claude/settings.json): when the edited file is
 * now over the line limit, exit 2 so the message reaches the agent, which then splits the file.
 * The build gate is `nx run file-size:check`; this only catches it earlier.
 */
import { readFileSync } from 'node:fs';
import { hookFeedback } from './lib/hook.ts';

function readOrNull(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

let input: unknown = null;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  // Not JSON: nothing to check.
}

const feedback = hookFeedback(input, readOrNull);
if (feedback !== null) {
  console.error(feedback);
  process.exit(2);
}
